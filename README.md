# ethereum-hd-keytool

Tools for management of HD wallet and the safe storage of secrets 

## Introduction

This tool manages generation, verification, storage and retrieval of hierarchy deterministic keys according to standards including BIP32 "Hierarchical Deterministic Wallets", BIP39 "Mnemonic code for generating deterministic keys" and BIP44 "Multi-Account Hierarchy for Deterministic Wallets".

The keys are managed in three tires. "Seed" is the root of the HD hierarchy and can derive all the other keys for the "purposes" and "addresses" under it. In another word, if a "seed" is exposed, all the keys under it are exposed. "Purposes" are nodes under a derivitive path of a "seed" and "addresses" are a number of Ethereum addresses derived under a "purpose". 

The hierarcy of keys to be managed by the tool along with configurations to handle the storage is described in the configuration file "config.json". 

## Product

Product of a "seed" is the BIP39 mnemonic words and the BIP32 single seed. Product of a "purpose" is the private extended key derived from the seed and the derivitive path of the "purpose". Product of an "address" is the private key and the public address of the "address".

Each "seed" and "purpose" is specified an ID in the configuration file. Product of "seed" and "purpose" is stored under folders named by the ID in accordance to their hierarchy ("purpose" under "seed"). 

Product of "address" is stored under the "purpose" under path like "000/412/00041243.json" according to their serial number.

## Open files

Under an "openDir", information of the product including the location of the pieces and the signature of the secrets and the pieces is stored for retrieval and verification. Content of both the configuration and files in this folder should be properly kept for later retrieval, but generally it's not needed to keep them in secrecy.

## Storage Schemes

Each product of the tool needs to be specified a storage scheme that specifies how the product is stored. Both secrecy and durability of the product should be considered to select an appropriate storage scheme. 

The following storage schemes are available:

### Shamir Secret Sharing

Under the Shamir secret sharing scheme, a secret is divided into a certain number of shares, and can be restored from a threshold number of shares. The following example sets up a Shamir secret sharing scheme for a product in which the secret is divided into 3 shares, and with any 2 of the shares the secret can be retrieved. The "destinations" specify the folders under which the shares are stored.

```
                "scheme": "shamir-secret-sharing",
                "totalShares": 3,
                "threshold": 2,
                "destinations": ["HK", "TW", "US"]
```

### 2 of 3 Storage scheme for BIP39 mnemonic words

This scheme is specially for storage and retrieval of BIP39 mnemonic words with length of 12. Under this scheme, the 12 words are divided into 3 pieces, and any 2 of them contain the all 12 words. The shares retain the original word, so the retrieval only depends on the availability of the shares, not on any specific tool (not even this tool) or software. Exactly three destinations must be provided. 

```
            "mnemonicStorage": {
                "scheme": "bip39-mnemonic-2of3",
                "destinations": ["HK", "TW", "US"]
            },
```            

### Clear storage scheme

As the name suggests, this storage scheme just store the product as is. A base path should be provided.

```
                    "addrStorage": {
                        "scheme": "clear",
                        "basePath": "ADDR"
                    }
```                    

## Usage

Typescript, node and npm are required to be installed before using this tool. After checking out the code, run `npm install` and `npm run build` under 'vsc folder'.

### Generate

Consult the provided "config.json" as an example. All products will be generated and saved under "prodDir". Open files will be saved under "openDir". A log will be write into the "retrieveLog". Seeds, purposes and addresses are saved according to their respective storage schemes. Under "generate" operation, seeds are always generated from random and other keys derived from the generated seeds.

Needless to say, the tool should be run in an offline environment on a dedicated device if what is generated is important.

To generate, edit the configuration file, then run `npm run kt generate` under vsc folder. Products are not saved directly in "generate" operation, only the files according to the storage scheme are saved.

Check the log to understand what is done.

### Retrieve

Under retrieve operation, this tool tries to restore all the products according to the configuration, so long it's possible, even if some (or even all) of the files are missing. For example, if some shares are missing but there is still threshold number of shares available, the tool will restore the product. Or, if the addresses are missing but the tool has retrieved the extended private key of the purpose, the tool will derive the addresses from the derivitive path again. If a product can both be derived and retrieved from the storage, the tool will verify if the two matches. The tool will also verify the signature of the files and the products stored under the openDir.

To retrieve, check the configuration file so that "prodDir", "openDir" are set properly, then run `npm run kt retrieve`. Retrieved products (keys) will be put under "retrieveDir". 

To test, generate with the provided example configuration, then run a retrieve to find the keys under the retrieve dir. Try delete certain files under the product dir and run retrieve again, and see if this tool can retrieve the products under such situation.

The retrieve operation will not generate any seed from random.

Check the log to understand what is done, what is missing, and what might be wrong.

### Complete

The "complete" operation is like "retrieve". Additionally, if any product cannot be retrieved from product storage (under "prodDir"), but can be derived from other product, the operation will again store the derived product under the "prodDir" according to the storage scheme. 

To "complete", run `npm run kt retrieve` 