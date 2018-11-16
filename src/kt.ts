require('source-map-support').install();
process.on('unhandledRejection', console.log);
// First check environment and prepare for running
console.log("**************************  VCLink Key Tools **********************************")
console.log("WARNNING: ONLY RUN ON A SECURE, OFFLINE COMPUTER UNDER AUDIT for production use")
console.log("Usage: node kt.js [command]")
console.log("Commands:")
console.log("    generate - generate the products")
console.log("    retrieve - retrieve the secrets")
console.log("    complete - retrieve the secrets and complete, when possible, any missing pieces")
console.log("**************************  VCLink Key Tools **********************************")

const fs = require('fs')
import { KeytoolConfig } from './lib/definitions'
import { TaskRunner } from './lib/task-runner'
const CFG_FILEPATH = "./config.json"

var argv = require('minimist')(process.argv.slice(2));
// read in configuration
const config = JSON.parse(fs.readFileSync(CFG_FILEPATH)) as KeytoolConfig
switch (argv._[0]) {
    case "generate":
        new TaskRunner(config, true, true).run()
        break
    case "retrieve":
        new TaskRunner(config, false, false).run()
        break
    case "complete":
        new TaskRunner(config, false, true).run()
        break
    default:
        console.log(`Command ${argv._[0]} is unknown or missing`)
}


