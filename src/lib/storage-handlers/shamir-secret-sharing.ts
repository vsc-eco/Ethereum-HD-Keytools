import {
    StorageScheme, StorageSchemeHandler, StorageProductDesc
} from '../definitions'

const pathmodule = require('path')
const secrets = require('secrets.js') // secret sharing
const Combinatorics = require('js-combinatorics'); // combination

interface ShamirSecretSharingScheme extends StorageScheme {
    totalShares: number
    threshold: number
    destinations: string[]
}

/**
 * combination of shares with verification for both storage and retrieval
 * @param shares 
 * @param threshold 
 */
function combineVerifyShares(shares: string[], threshold: number): { content: Buffer, contentStatus: string } {
    if (shares.length >= threshold) {
        // retrieve the content, and verify all combination reaches the same content
        const combinationResultSet: Set<string> = new Set() // hex string
        combinationResultSet.add(secrets.combine(shares))
        const combinationGenerator = Combinatorics.bigCombination(shares, threshold)
        let c // loop combinations
        while (c = combinationGenerator.next()) {
            combinationResultSet.add(secrets.combine(c))
        }
        if (combinationResultSet.size !== 1) {
            return {
                content: undefined,
                contentStatus:"FAIL:combinations do not match"
            } 
        }
        return {
            content: Buffer.from(combinationResultSet.values().next().value, 'hex'),
            contentStatus: "OK"
        }
    } else {
        return {
            content:undefined,
            contentStatus:"MISSING"
        } 
    }
}

class ShamirSecretSharingHandler extends StorageSchemeHandler {
    store(content: Buffer, path: string, scheme: StorageScheme): StorageProductDesc {
        const result : StorageProductDesc = {
            shares:{},
            shareStatus:undefined
        }
        const sscheme: ShamirSecretSharingScheme = scheme as ShamirSecretSharingScheme
        // split content 
        const hexStrContent = content.toString('hex')
        const shares: string[] = secrets.share(hexStrContent,  // shares are some hex string
            sscheme.totalShares, sscheme.threshold
        )
        // verify
        let vres = combineVerifyShares(shares, sscheme.threshold)
        if ((vres.contentStatus !== "OK") || (vres.content.compare(content)!==0)){
            throw "Unexpected error, check Shamir Secret Sharing handler and library"
        }
        // store secret shares 
        for (var i = 0; i < sscheme.totalShares; i++) {
            const shareDest = sscheme.destinations[i] // such as 'TW', 'HK'
            result.shares[pathmodule.join(shareDest, path)] = Buffer.from(shares[i], 'utf8')
        }
        return result
    }

    /**
     * retrieve and verify the shares, then test all combination of the threshold number of 
     * shares for the same result, and retrieve the content, and verify the content
     * @param path 
     * @param scheme 
     */
    retrieve(product: StorageProductDesc, path: string, scheme: StorageScheme)
        : { content: Buffer, contentStatus: string } {
        const sscheme: ShamirSecretSharingScheme = scheme as ShamirSecretSharingScheme
        // retrieve the shares
        const shares: string[] = Object.values(product.shares).map(b=>b.toString('utf8'))
        // return the result
        return combineVerifyShares(shares, sscheme.threshold)
    }
}

export {
    ShamirSecretSharingHandler
}
