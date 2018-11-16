import { StorageProductDesc, StorageScheme, StorageSchemeHandler, KeytoolConfig } from './definitions'
import { safeReadFile, safeWriteFile, pad } from './tools'
const SHA3 = require('sha3')
const pathmodule = require('path')
import { WriteStream, open, write } from 'fs'

// storage schema handler registry
type StorageSchemeHandlerClass = { new(...args: any[]): StorageSchemeHandler }

import { ShamirSecretSharingHandler } from './storage-handlers/shamir-secret-sharing'
import {BIP39Mnemonic2of3Handler} from './storage-handlers/bip39-mnemonic-2of3'
import {ClearStorageHandler} from './storage-handlers/clear-storage'

const STORAGE_SCHEME_HANDLERS: { [handlerName: string]: StorageSchemeHandlerClass } = {
    'shamir-secret-sharing': ShamirSecretSharingHandler,
    'bip39-mnemonic-2of3': BIP39Mnemonic2of3Handler,
    'clear': ClearStorageHandler
}

function sha3(content: string | Buffer): string {
    const sha3 = new SHA3.SHA3Hash()
    sha3.update(content)
    return sha3.digest('hex')
}

function updateLengthSignature(result: any, content: string | Buffer): any {
    result.length = content.length
    result.signature = sha3(content)
    return result
}

/**
 * Open content for a secret content
 */
interface OpenContent {
    length: number
    signature: string
    type: string
    storagePieces: {
        [path: string]: {
            length: number,
            signature: string,
        }
    }
}

function getOpenContent(content: Buffer | string, product: StorageProductDesc): OpenContent {
    let result: OpenContent = updateLengthSignature({
        storagePieces: {},
        type: typeof content === 'string' ? 'string' : 'Buffer'
    }, content)
    for (let path in product.shares) {
        result.storagePieces[path] = updateLengthSignature({}, product.shares[path])
    }
    return result
}


class GeneralStorageManager {
    constructor(
        public config: KeytoolConfig
    ) { }
    private getHandler(name: string): StorageSchemeHandler {
        let hc: StorageSchemeHandlerClass = STORAGE_SCHEME_HANDLERS[name]
        if (hc) {
            return new hc(this.config)
        } else {
            throw `Storage: unknown scheme ${name}`
        }
    }
    /**
     * (1) get open content from the secret content and the storage product
     * (2) persist all pieces from storage product
     * (3) persist open content
     * @param content 
     * @param path 
     * @param product 
     */
    private persist(content: string | Buffer, path: string, product: StorageProductDesc): void {
        const open = getOpenContent(content, product)
        for (let ppath in product.shares) {
            const absPath = pathmodule.join(this.config.prodDir, ppath)
            safeWriteFile(product.shares[ppath], absPath)
        }
        safeWriteFile(JSON.stringify(open, null, 2), pathmodule.join(this.config.openDir, path + ".json"))
    }
    /**
     * (1) load open content 
     * (2) load & verify pieces & put into StorageProductDesc
     * @param path 
     */
    private load(path: string): { open: OpenContent, prod: StorageProductDesc } {
        const openJSON = safeReadFile(pathmodule.join(this.config.openDir, path + ".json"))
        if (!openJSON){
            return {
                open: undefined,
                prod: undefined
            }
        }
        const open = JSON.parse(openJSON.toString('utf8')) as OpenContent
        const result: StorageProductDesc = {
            shares: {},
            shareStatus: {}
        }
        // load & verify pieces
        for (let path in open.storagePieces) {
            const pInfo = open.storagePieces[path]
            const piece: Buffer = safeReadFile(pathmodule.join(this.config.prodDir, path))
            if (piece) {
                if (piece.length === pInfo.length && sha3(piece) === pInfo.signature) {
                    result.shares[path] = piece
                    result.shareStatus[path] = "OK"
                } else {
                    result.shareStatus[path] = "ERROR: length or signature not match"
                }
            } else {
                result.shareStatus[path] = "MISSING"
            }
        }
        return { open: open, prod: result }
    }
    /**
     * (1) Transform content into storage product 
     * (2) call persist to persist pieces and signatures
     * @param content 
     * @param path 
     * @param scheme 
     */
    store(content: string | Buffer, path: string, scheme: StorageScheme): void {
        let bufferContent: Buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content
        let product = this.getHandler(scheme.scheme).store(bufferContent, path, scheme)
        this.persist(content, path, product)
    }
    /**
     * 
     * @param path 
     * @param scheme 
     */
    retrieve(path: string, scheme: StorageScheme, logStream: WriteStream): string | Buffer | undefined {
        const { open, prod } = this.load(path)
        if (!open) {
            // missing open file
            if (logStream){
                logStream.write(`OPEN\t${path}\tMISSING\n`)
            }
            return undefined
        }
        let { content, contentStatus } = this.getHandler(scheme.scheme).retrieve(prod, path, scheme)
        // verify content
        if (content) {
            if (content.length !== open.length || sha3(content) !== open.signature) {
                content = undefined
                contentStatus = "ERROR: length or signature not match"
            }
        }
        // here we handles logging, as verification
        if (logStream) {
            logStream.write(`Content\t${path}\t${contentStatus}\n`)
            for (let ppath in prod.shareStatus) {
                logStream.write(`Piece\t${ppath}\t${prod.shareStatus[ppath]}\n`)
            }
        }
        // save content
        if (content && this.config.retrieveDir) {
            safeWriteFile(content, pathmodule.join(this.config.retrieveDir, path))
        }
        // return content of correct type
        if (content) {
            switch (open.type) {
                case "string": return content.toString('utf8'); break
                case "Buffer": return content; break;
                default: throw `Unknown type ${open.type}`
            }
        }
        else return undefined
    }
}

export {
    GeneralStorageManager
}