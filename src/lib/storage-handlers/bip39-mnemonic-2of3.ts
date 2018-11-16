import {
    StorageScheme, StorageSchemeHandler, StorageProductDesc
} from '../definitions'

const pathmodule = require('path')

interface Share {
    path: string
    words:{[index: string]: string}
}

interface BIP39Mnemonic2of3Scheme extends StorageScheme {
    destinations: string[]
}

const SCHEME: number[][] = [[0, 1, 2, 3, 4, 5, 6, 7], [4, 5, 6, 7, 8, 9, 10, 11], [0, 1, 2, 3, 8, 9, 10, 11]]

function verifySplitMnemonic(mnemonic: string): string[] {
    const result = mnemonic.split(" ")
    if ((result.length !== 12) || (result.join(" ") !== mnemonic)) {
        throw "not mnemonic string"
    }
    return result
}

class BIP39Mnemonic2of3Handler extends StorageSchemeHandler {
    store(content: Buffer, path: string, scheme: StorageScheme): StorageProductDesc {
        const result: StorageProductDesc = {
            shares: {},
            shareStatus: undefined
        }
        const sscheme = scheme as BIP39Mnemonic2of3Scheme
        const mnemonic: string = content.toString('utf8')
        const words: string[] = verifySplitMnemonic(mnemonic)
        // split and store
        for (let i = 0; i < 3; i++) {
            const share_positions = SCHEME[i]
            const share: Share = {
                path:path,
                words:{} 
            }
            for (let p of share_positions) {
                share.words[String(p)] = words[p]
            }
            const sPath = pathmodule.join(sscheme.destinations[i], path)
            result.shares[sPath] = Buffer.from(JSON.stringify(share, null, 2), 'utf8')
        }
        return result
    }
    retrieve(product: StorageProductDesc, path: string, scheme: StorageScheme): { content: Buffer; contentStatus: string; } {
        // assemble
        const words = []
        let count = 0
        Object.values(product.shares).forEach((shareJSON) => {
            const share: Share = JSON.parse(shareJSON.toString('utf8')) as Share
            for (let p in share.words){
                if (words[Number(p)]) { // if already exists
                    if (share.words[p] !== words[Number(p)]) {
                        // same position from different shares do not match
                        return { content: undefined, contentStatus: "ERROR inconsistent pieces" }
                    }
                } else {
                    words[Number(p)] = share.words[p]
                    count++
                }
            }
        })
        // verify
        if (words.length === 12 && count === 12) {
            return {
                content: Buffer.from(words.join(" "), "utf8"),
                contentStatus: "OK"
            }
        } else {
            return {
                content: undefined,
                contentStatus: "ERROR missing pieces"
            }
        }
    }
}

export {
    BIP39Mnemonic2of3Handler
}