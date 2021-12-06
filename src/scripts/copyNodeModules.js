const path = require('path')
const fsx = require('fs-extra')
const dircompare = require('dir-compare')

const basePath = path.resolve()
const from = path.resolve(basePath, 'node_modules')
const to = path.resolve(basePath, 'dist/release/node_modules')

let shouldCopy = true
if (fsx.existsSync(to)) {
  const res = dircompare.compareSync(from, to, { compareDate: true, compareSize: true })
  console.log(`Compared node_modules, found ${res.differencesDirs} differences`)
  shouldCopy = !res.same
}

if (shouldCopy) {
  fsx.copySync(from, to, { overwrite: true, recursive: true, dereference: true })
}
