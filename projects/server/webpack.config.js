const path = require('path')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals');
const CopyWebpackPlugin = require('copy-webpack-plugin')
const WebpackShellPluginNext = require('webpack-shell-plugin-next')

// add the version number to the top of the app.js file
const PACKAGE = require('./package.json')
const banner =  `${PACKAGE.name} - ${PACKAGE.version} generated at ${new Date().toISOString()}`

module.exports = (env) => {
  env.BUILD = 'webpack'
  const isDebug = env.NODE_ENV === 'debug'
  const outPath = path.resolve(__dirname, `../../dist/${env.NODE_ENV}/server`)

  return {
    // this opts out of automatic optimisations - do NOT set this to production as the app
    // will crash and the error message is so big it lags out everything
    mode: 'none',
    entry: './app.ts',
    resolve: {
      extensions: ['.js', '.ts'],
      alias: {
        "@rebel/server": path.resolve(__dirname, '../../projects/server'),
        "@rebel/masterchat": path.resolve(__dirname, '../../projects/masterchat/src')
      }
    },

    // required to surpress some module errors.
    // this means that, instead of requiring webpack to bundle the module, we promise that the module name
    // will be available as a global variable at runtime (e.g. because we loaded it via a <script> in the HTML page).
    // see https://stackoverflow.com/questions/52507232/how-to-exclude-a-module-from-webpack-and-instead-import-it-using-es6
    externals: {
      // e.g. fs
      ...nodeExternals(),

      // https://github.com/prisma/prisma/issues/6564#issuecomment-899013495
      '_http_common': 'commonjs2 _http_common',

      // these modules are required by typescript-rest only if we are explicitly using the IOC option (which we are not), so ignore
      'typescript-ioc': 'typescript-ioc',
      'typescript-ioc/es6': 'typescript-ioc/es6',

      // we don't use it in webpack builds, but not marking it as an external here will cause a 'Module not found' error
      'module-alias/register': {},

      // this is in the node_modules/ws/lib/validation.js file, and is safe to ignore as there is a fallback mechanism for when the module doesn't exist
      'utf-8-validate': 'utf-8-validate',

      // this is in the node_modules/ws/lib/buffer-util.js file, and is safe to ignore as there is a fallback mechanism for when the module doesn't exist
      'bufferutil': 'bufferutil'
    },
    target: 'node',

    // better stack traces in production errors, but slow builds
    devtool: 'source-map',

    ignoreWarnings: [/Critical dependency: the request of a dependency is an expression/],

    output: {
      path: outPath,
      // output path is already dist somehow
      filename: `./app.js`
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: { 
            'loader': 'ts-loader',
            'options': {
              // this is the equivalent of adding the --build flag to tsc.
              // see https://medium.com/@nickexcell/using-typescript-project-references-with-ts-loader-and-webpack-part-1-5d0c3cd7c603
              'projectReferences': true
            }
          }
        }
      ]
    },
    plugins: [
      new webpack.BannerPlugin(banner),
      new webpack.DefinePlugin({
        'process.env':{
          // in the built file, webpack will replace `process.env.[variable]` with the
          // provided string value, unwrapping one layer of quotation marks
          'NODE_ENV': `"${env.NODE_ENV}"`,
          'BUILD': `"webpack"`
        }
      }),

      // https://webpack.js.org/plugins/copy-webpack-plugin/
      // note: path.resolve doesn't work with glob patterns
      new CopyWebpackPlugin({
        patterns: [
          {
            // the file we are interested in has 'engine' in its name.
            // see https://www.prisma.io/docs/concepts/components/prisma-engines/query-engine
            from: './node_modules/.prisma/client/*engine*', // `query_engine-windows.dll.node` for windows
            to: outPath,
          },
          {
            // required for prisma to find the schema file
            // see https://github.com/prisma/prisma/issues/2303#issuecomment-768358529
            from: path.resolve(__dirname, './node_modules/.prisma/client/schema.prisma'),
            to: outPath,
          },
          {
            from: '../../node_modules/ngrok/bin/**', // `ngrok.exe` for windows
            to: path.resolve(outPath, '../bin/') // it has to go here exactly, otherwise ngrok won't find it (folder is automatically created)
          }
        ],
      })
    ]
  }
}
