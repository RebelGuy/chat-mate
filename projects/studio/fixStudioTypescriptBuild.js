/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs')

// when running locally, the TypescriptPerformance file is located in the node_modules of the react-dev-utils package.
// during CI, it's located directly in the fork-ts-checker-webpack-plugin package.

if (fs.existsSync('../../node_modules/react-dev-utils')) {
  fs.copyFileSync('./TypeScriptPerformance.js', '../../node_modules/react-dev-utils/node_modules/fork-ts-checker-webpack-plugin/lib/typescript-reporter/profile/TypeScriptPerformance.js')
} else {
  fs.copyFileSync('./TypeScriptPerformance.js', '../../node_modules/fork-ts-checker-webpack-plugin/lib/typescript-reporter/profile/TypeScriptPerformance.js')
}
