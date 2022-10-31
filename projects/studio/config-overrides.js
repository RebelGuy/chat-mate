// this is for configuring the `react-app-rewired` package. why? because the vanilla `react-scripts` have presets that don't work with our project setup.
// react-scripts don't support path aliasing. oddly, VSCode was also having issues until this config file was added.

// current known limitation: sourcemaps don't seem to work for modules outside of the /src folder

const { aliasDangerous, aliasJest, configPaths } = require('react-app-rewire-alias/lib/aliasDangerous')

const aliasMap = configPaths('./tsconfig.paths.json')

module.exports = (...args) => {
  const config = aliasDangerous(aliasMap)(...args) // dangerous because we are importing from outside the /src folder

  // some packages are node-specific, so we need to polyfill them to work in browsers: https://stackoverflow.com/a/70485253
  return {
    ...config,
    resolve: {
      ...config.resolve,
      fallback: {
        ...config.fallback,
        'crypto': require.resolve('crypto-browserify'),
        'stream': require.resolve('stream-browserify')        
      }
    }
  }
}
module.exports.jest = aliasJest(aliasMap)
