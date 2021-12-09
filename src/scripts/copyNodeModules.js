const path = require('path')
const fsx = require('fs-extra')
const dircompare = require('dir-compare')

const basePath = path.resolve()
const from = path.resolve(basePath, 'node_modules')
const to = path.resolve(basePath, 'dist/release/node_modules')
// don't copy devDependencies, see https://stackoverflow.com/questions/36222967/how-to-omit-devdependencies-when-copying-node-modules
// either re-install, or use https://github.com/wan2land/distize with the no-files flag
let shouldCopy = true
if (fsx.existsSync(to)) {
  const res = dircompare.compareSync(from, to, { compareDate: true, compareSize: true })
  console.log(`Compared node_modules, found ${res.differencesDirs} differences`)
  shouldCopy = !res.same
}

if (shouldCopy) {
  fsx.copySync(from, to, { overwrite: true, recursive: true, dereference: true })
}
