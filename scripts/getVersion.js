// Outputs the current version and latest commit's hash.

const execSync = require('child_process').execSync
const package = require(`../package.json`)

const numCommits = execSync(`git rev-list HEAD --count`).toString().trim()
const versionParts = package.version.split('.')
versionParts[2] = `${numCommits}`
const version = versionParts.join('.')
const hash = execSync(`git rev-parse --short HEAD`)

console.log(`${version} ${hash}`)
