/**
 * Just some utilities
 */
const fs = require('fs')
var fx = require('mkdir-recursive');
const pathmodule = require('path')

function pad(n, size=5) {
    const s = String(n)
    const zeros = size - s.length
    if (zeros > 0 ) {
        return Array(zeros+1).join("0")+s
    } else {
        return s
    }
}
/**
 * Read contents from path, return undefined if file does not exist
 * @param path 
 */
function safeReadFile(path:string):Buffer|undefined {
    if (!path) {
        throw `Invalid path for read ${path}`
    }    
    try {
        return fs.readFileSync(path)
    } catch (e) {
        if (e.code === 'ENOENT') {
            return undefined
        }
        throw e // other errors
    }
}
/**
 * Write data into file under path, after create dir recursively
 * @param data 
 * @param path 
 */
function safeWriteFile(data:any, path:string) {
    if (!path) {
        throw `Invalid path for write ${path}`
    }
    const {dir} = pathmodule.parse(path)
    fx.mkdirSync(dir, {recursive:true})
    fs.writeFileSync(path,data)
}

export {
    pad,
    safeReadFile,
    safeWriteFile
}