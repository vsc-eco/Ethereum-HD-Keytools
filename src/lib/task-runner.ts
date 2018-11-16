/**
 * process
 */
import fs = require('fs')
const slLog = require('single-line-log').stdout
import { KeytoolConfig, StorageScheme } from './definitions'
import { GeneralStorageManager } from './storage-manager'
import { pad, safeWriteFile } from './tools';

const bip39 = require('bip39')
const hdkey = require('ethereumjs-wallet/hdkey')
const ethWallet = require('ethereumjs-wallet')
const util = require('ethereumjs-util')

function isDerivitivePath(path: string): boolean {
    return path.match(/^m(\/\d+'?)+$/) !== null
}

function verifyRetrieved(a: string | Buffer, b: string | Buffer): boolean | null {
    // only raises issue if both exists and not match
    if (a === undefined || b === undefined) { return null }
    if (typeof a === 'string' && a === b) { return true }
    if ((<Buffer>a).compare(b as Buffer) === 0) { return true }
    return false
}

interface AddressJSON {
    path: string
    index: number
    address: string
    message: string
    signature: string
}

class TaskRunner {
    constructor(
        public config: KeytoolConfig,
        public generate: boolean,
        public complete: boolean,
    ) {
        this.store = new GeneralStorageManager(config)
        // check folders
        if (generate) {
            if (fs.existsSync(config.openDir) || fs.existsSync(config.prodDir)) {
                console.log("Destination path exists and this tool would not overwrite.")
                process.exit(1)
            }
        } else {
            if (!(fs.existsSync(config.openDir) && fs.existsSync(config.prodDir))) {
                console.log("Product or Open path does not exist.")
                process.exit(1)
            }
            if (config.retrieveDir && fs.existsSync(config.retrieveDir)) {
                console.log("Retrieve dir already exists and this tool does not overwrite.")
                process.exit(1)
            }
        }
    }

    store: GeneralStorageManager
    logStream: fs.WriteStream

    log(message) {
        if (this.logStream) {
            this.logStream.write(message)
        }
    }

    /**
     * Retrieve content from path and scheme, and verify with (if provided) computed content.
     * If generate is true or complete is true, and if computed content is provided, and retrieved not, then
     * save the computed content.
     * 
     * So this method is for both storage and retrieval and verification with computed value
     * 
     * Throw error if both are available but not match. Otherwise return whichever available, or the retrieved.
     * 
     * @param derivedContent - the computed content
     * @param path 
     * @param scheme 
     */
    retrieveAndComplete(
        derivedContent: string | Buffer,
        path: string,
        scheme: StorageScheme,
    ): string | Buffer | undefined {
        // try retrieve if not in generate mode
        const retrieved = this.generate ? undefined : this.store.retrieve(path, scheme, this.logStream)
        // verify 
        if (!this.generate) {
            const verifyRes = verifyRetrieved(derivedContent, retrieved)
            if (verifyRes === false) {
                throw `ERROR: re-generated content does not match retrieved content at ${path}`
            } else if (verifyRes === true) {
                this.log(`D/R-Verify\t${path}\tOK\n`)
            } else {
                this.log(`D/R-Verify\t${path}\tSkipped\n`)
            }
        }

        // complete?
        if (retrieved === undefined && derivedContent && (this.generate || this.complete)) {
            this.log(`Content\t${path}\tSAVED\n`)
            this.store.store(derivedContent, path, scheme)
        }
        slLog(`Generate/retrieved ${path}                                               \n`)
        // return
        if (derivedContent !== undefined) {
            return derivedContent
        } else {
            return retrieved // whatever it may be
        }
    }

    run(): void {
        // open log stream
        this.logStream = this.config.retrieveLog ? (() => {
            safeWriteFile("", this.config.retrieveLog); return fs.createWriteStream(this.config.retrieveLog)
        })() : undefined

        // iterate seeds
        for (let seedId in this.config.seeds) {
            const seedConfig = this.config.seeds[seedId]
            // generate/retrieve mnemonic word
            const mnemonic: string = this.retrieveAndComplete(
                this.generate ? bip39.generateMnemonic() : undefined,
                `root/${seedId}/mnemonic.txt`, seedConfig.mnemonicStorage) as string
            if (mnemonic !== undefined && (!bip39.validateMnemonic(mnemonic))) {
                throw "not expected"
            }
            const seed: Buffer = this.retrieveAndComplete(
                mnemonic ? bip39.mnemonicToSeed(mnemonic) : undefined,
                `root/${seedId}/seed.txt`, seedConfig.seedStorage
            ) as Buffer

            // verify
            if (mnemonic && seed) {
                if (bip39.mnemonicToSeed(mnemonic).compare(seed) !== 0) {
                    throw 'mnemonic & seed does not match' // this should not happen
                } else {
                    this.log(`VERIFY\t${seedId}#[mnemonic,seed]\tOK\n`)
                }
            } else {
                this.log(`VERIFY\t${seedId}#[mnemonic,seed]\tSKIPPED missing mnemonic or seed (or both)\n`)
            }
            // master node
            const hdWallet = seed ? hdkey.fromMasterSeed(seed) : undefined

            // iterate through purposes
            for (let purposeId in seedConfig.purposes) {
                const purposeConfig = seedConfig.purposes[purposeId]
                // check the path
                if (!isDerivitivePath(purposeConfig.path) || 
                    Object.values(seedConfig.purposes).filter((pcfg)=>{return pcfg.path===purposeConfig.path}).length !== 1
                ) {
                    throw `ERROR: derivitive path for ${seedId}/${purposeId} invalid or duplicate`
                }
                let keyPurpose = hdWallet ? hdWallet.derivePath(purposeConfig.path) : undefined
                const keyPurposePrivateExtended: string = this.retrieveAndComplete(
                    keyPurpose ? keyPurpose.privateExtendedKey() : undefined,
                    `purpose/${seedId}/${purposeId}/private-extended-key.txt`,
                    purposeConfig.privateKeyExtendedStorage
                ) as string
                // if retrieved, restore the key
                if (keyPurposePrivateExtended && keyPurpose === undefined) {
                    keyPurpose = hdkey.fromExtendedKey(keyPurposePrivateExtended)
                }
                // iterate through range
                for (let i = 0; i < purposeConfig.range; i++) {
                    const paddedIndex = pad(i, 8)
                    const dividedPath = `${paddedIndex.substr(0,3)}/${paddedIndex.substr(3,3)}`
                    const storePath = `${seedId}/${purposeId}/${dividedPath}/${paddedIndex}`
                    const childIndex = (purposeConfig.hardened ? 0x80000000 : 0) + i
                    const childPath = purposeConfig.path + '/' + i + (purposeConfig.hardened ? "'" : "")
                    let keyChild = keyPurpose ? keyPurpose.deriveChild(childIndex).getWallet() : undefined
                    const keyChildFromPath = hdWallet ? hdWallet.derivePath(childPath).getWallet() : undefined
                    if (keyChild && keyChildFromPath) {
                        if(! verifyRetrieved(keyChild.getPrivateKey(), keyChildFromPath.getPrivateKey())) {
                            throw `Error: derived and retrieved child key ${seedId}/${purposeId}/${i} does not match`
                        } else {
                            this.log(`VERIFY\t${storePath}#[deriveChild-derivePath]\tOK\n`)
                        }
    
                    } else {
                        this.log(`VERIFY\t${storePath}#[deriveChild-derivePath]\tSkipped\n`)
                    } 
                    const keyChildPrivate = this.retrieveAndComplete(
                        keyChild ? keyChild.getPrivateKey() as Buffer : undefined,
                        `address-private/${storePath}`, purposeConfig.addrPrivateKeyStorage
                    ) as Buffer
                    // restore keyChild if not derived
                    if (keyChild === undefined && keyChildPrivate !== undefined) {
                        keyChild = ethWallet.fromPrivateKey(keyChildPrivate)
                    }
                    // prepare derived address and proof
                    const derivedAddressJSON = keyChild ? function () {
                        const address = keyChild.getChecksumAddressString()
                        const message = `sign by ${address}`
                        const signature = util.ecsign(util.keccak256(message), keyChildPrivate)
                        const rpcSig = util.toRpcSig(signature.v, signature.r, signature.s)
                        return {
                            path: childPath,
                            index: childIndex,
                            address: address,
                            message:message,
                            signature: rpcSig
                        } as AddressJSON
                    }() : undefined
                    const addrDoc = this.retrieveAndComplete(
                        JSON.stringify(derivedAddressJSON, null, 2),
                        `address/${storePath}.json`, purposeConfig.addrStorage
                    ) as string
                    const addrJSON = addrDoc?JSON.parse(addrDoc) as AddressJSON:undefined
                    // verify address
                    if (addrJSON) {
                        const signature = util.fromRpcSig(addrJSON.signature)
                        if ('0x' + util.pubToAddress(util.ecrecover(util.keccak256(addrJSON.message), signature.v, signature.r, signature.s)).toString('hex').toLowerCase()
                            !== addrJSON.address.toLowerCase()) {
                            throw `ERROR: Invalid public address JSON ${storePath}`
                        }
                        this.log(`VERIFY ${storePath}#[address-message-signature] OK\n`)
                        // verify with private key if available
                        if (keyChild) {
                            if (keyChild.getChecksumAddressString() !== addrJSON.address) {
                                throw `ERROR: public address JSON does not match with private key ${storePath}`
                            }
                            this.log(`VERIFY ${storePath}#[private-key-address] OK\n`)
                        }
                    }
                }
            }
        }

        if (this.logStream) {
            this.logStream.end()
        }
        console.log("DONE")
    }
}


export {
    TaskRunner
}