/* eslint-disable */
// this is for configuring the `react-app-rewired` package. why? because the vanilla `react-scripts` have presets that don't work with our project setup.
// react-scripts don't support path aliasing. oddly, VSCode was also having issues until this config file was added.

// current known limitation: sourcemaps don't seem to work for modules outside of the /src folder

const { aliasDangerous, aliasJest, configPaths } = require('react-app-rewire-alias/lib/aliasDangerous')
const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const aliasMap = configPaths('./tsconfig.paths.json')

module.exports = (...args) => {
  const config = aliasDangerous(aliasMap)(...args) // dangerous because we are importing from outside the /src folder

  // https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/issues/525#issuecomment-1008331771
  let forkTsPlugInInstances = config.plugins.find(p => p.constructor.name === 'ForkTsCheckerWebpackPlugin')
  if (forkTsPlugInInstances) {
    forkTsPlugInInstances.options.typescript.build = true
  }

  // some packages are node-specific, so we need to polyfill them to work in browsers: https://stackoverflow.com/a/70485253
  return {
    ...config,
    resolve: {
      ...config.resolve,
      fallback: {
        ...config.fallback,
        'crypto': false, // don't need it in Studio, but need to specify an empty implementation so we can import functions from files that contain other functions using `crypto`
        'stream': require.resolve('stream-browserify')
      }
    },
    plugins: [...(config.plugins ?? []),
      // it can't resolve `node:url` (and similar), so we have to manually set those
      // https://stackoverflow.com/questions/71041521/unhandledschemeerror-what-is-this-nodebuffer-error-and-how-do-i-solve-it
      new webpack.NormalModuleReplacementPlugin(/node:/, (resource) => {
        const mod = resource.request.replace(/^node:/, "")
        switch (mod) {
          case 'buffer':
            resource.request = 'buffer'
            break
          case 'stream':
            resource.request = 'stream-browserify'
            break
          case 'url':
            resource.request = 'url-polyfill'
            break
          default:
            throw new Error(`Not found ${mod}`)
        }
      }),

      new CopyWebpackPlugin({ patterns: [
        // the favicon is automatically picked up by the `index.html`
        { from: `favicon_${process.env.CHAT_MATE_ENV}.ico`, to: 'favicon.ico' }
      ] })
    ]
  }
}
module.exports.jest = aliasJest(aliasMap)
