interface KeytoolConfig {
    prodDir: string
    openDir: string
    retrieveDir: string
    retrieveLog: string
    seeds: {
        [seedid:string]: {
            mnemonicStorage: StorageScheme
            seedStorage: StorageScheme
            purposes: {
                [purposeId: string]: {
                    path: string
                    range: number
                    hardened: boolean
                    privateKeyExtendedStorage:StorageScheme
                    addrPrivateKeyStorage: StorageScheme
                    addrStorage: StorageScheme
                }
            }
        }
    }
}

/**
 * storage module - save and retrieve according to schemes
 */

/**
 * StorageScheme defines how to store a value
 */
interface StorageScheme {
    scheme: string;
    [key:string]: any; // other configurations
}
/**
 * The storage manager will be responsible to store/retrieve/verify each shares and the content, and 
 * the StorageSchemeHandlers are responsible to transform the content into shares (possible multiple)
 * and back. This class serve as the interface between the two.
 * 
 * Upon store, StorageSchemeHandler transform content into shares. Upon retrieval, storage manager retrieves
 * each share, and put into StorageProductDesc (if verified ok) together with status and send in as input
 */
interface StorageProductDesc {
    shares: {
        [path:string]:Buffer|undefined
    }
    shareStatus: {
        [path:string]:string
    }
}

/**
 * Storage handler stores content into storage, or retrieves and
 * verifies content from storage. It expects a specific storage 
 * structure under a common root
 */
abstract class StorageSchemeHandler  {
    constructor(public config: KeytoolConfig){
        // just pass in config
    }
    /**
     * stores content into storage 
     * @param content 
     * @param path 
     * @param scheme 
     */
    abstract store(
        content:Buffer,
        path: string,
        scheme: StorageScheme
    ):StorageProductDesc;
    /**
     * retrieves content from path & scheme
     * @param path 
     * @param scheme 
     */
    abstract retrieve(
        product: StorageProductDesc,
        path: string,
        scheme: StorageScheme
    ): {
        content: Buffer,
        contentStatus: string
    };
}

/**
 * Thrown when unable to retrieve the content
 */
class StorageRetrievalException {
    constructor(
        public message:string,
        public path:string,
        public details: any,
        ){}
}

/**
 * Thrown when verification of the content failed
 */
class StorageVerificationException {
    constructor(
        public message:string,
        public path:string,
        public details: any,
        ){}
}

export {
    KeytoolConfig,
    StorageScheme,
    StorageSchemeHandler,
    StorageProductDesc
}