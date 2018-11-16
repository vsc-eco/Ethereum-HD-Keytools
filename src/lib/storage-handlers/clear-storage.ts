import {
    StorageScheme, StorageSchemeHandler, StorageProductDesc
} from '../definitions'
const pathmodule = require('path')

interface ClearStorageScheme extends StorageScheme{
    basePath: string
}

/**
 * Storage handler that just save the content
 */
class ClearStorageHandler extends StorageSchemeHandler {
    store(content: Buffer, path: string, scheme: StorageScheme): StorageProductDesc {
        const cscheme = scheme as ClearStorageScheme
        return {
            shares:{
                [pathmodule.join(cscheme.basePath, path)] : content
            },
            shareStatus:undefined
        }
    }

    /**
     * retrieve 
     * @param path 
     * @param scheme 
     */
    retrieve(product: StorageProductDesc, path: string, scheme: StorageScheme)
        : { content: Buffer, contentStatus: string } {
        const values = Object.values(product.shares)
        switch (values.length) {
            case 0: return {
                content: undefined, contentStatus:"MISSING"
            }
            case 1: return {
                content: values[0], contentStatus: "OK"
            }
            default:
                throw `should not happen`
        }
    }
}

export {
    ClearStorageHandler
}
