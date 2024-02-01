// Outputs the current version and latest commit's hash.

const execSync = require('child_process').execSync
const package = require(`../package.json`)

const version = package.version
const numCommits = execSync(`git rev-list HEAD --count`).toString().trim()
const hash = execSync(`git rev-parse --short HEAD`)

console.log(`${version}.${numCommits} (${hash})`)
