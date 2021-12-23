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

    // required to surpress some module errors
    externals: {
      // e.g. fs
      ...nodeExternals(),

      // https://github.com/prisma/prisma/issues/6564#issuecomment-899013495
      '_http_common': 'commonjs2 _http_common',

      // these modules are required by typescript-rest only if we are explicitly using the IOC option (which we are not), so ignore
      'typescript-ioc': 'typescript-ioc',
      'typescript-ioc/es6': 'typescript-ioc/es6',

      // we don't use it in webpack builds, but not marking it as an external here will cause a 'Module not found' error
      'module-alias/register': {}
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

      // required for prisma to find the schema file
      // see https://github.com/prisma/prisma/issues/2303#issuecomment-768358529
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, './node_modules/.prisma/client/query_engine-windows.dll.node'),
            to: outPath,
          },
          {
            from: path.resolve(__dirname, './node_modules/.prisma/client/schema.prisma'),
            to: outPath,
          },
        ],
      }),

      // required for prisma to get an updated generated client
      // this doesn't seem to do anything...
      new WebpackShellPluginNext({
        onBuildEnd: [isDebug ? 'yarn generate' : 'yarn migrate:release']
      })
    ]
  }
}
