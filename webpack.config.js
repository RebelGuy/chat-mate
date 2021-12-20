const path = require('path')
const webpack = require('webpack')

// add the version number to the top of the app.js file
const PACKAGE = require('./package.json')
const banner =  `${PACKAGE.name} - ${PACKAGE.version} generated at ${new Date().toISOString()}`

module.exports = (env) => {
  env.BUILD = 'webpack'
  console.log('__dirname:', __dirname)

  return {
    // this opts out of automatic optimisations - do NOT set this to production as the app
    // will crash and the error message is so big it lags out everything
    mode: 'none',
    entry: 'app.ts',
    resolve: {
      extensions: ['.js', '.ts'],
      modules: [path.resolve(__dirname, 'node_modules')],
      alias: {
        "@rebel/*": path.resolve(__dirname, 'projects/*'),
      }
    },

    // required to surpress some module errors
    externals: {
      // https://github.com/prisma/prisma/issues/6564#issuecomment-899013495
      '_http_common': 'commonjs2 _http_common',

      // these modules are required by typescript-rest only if we are explicitly using the IOC option (which we are not), so ignore
      'typescript-ioc': 'typescript-ioc',
      'typescript-ioc/es6': 'typescript-ioc/es6',

      // we don't use it in webpack builds, but not marking it as an external here will cause a 'Module not found' error
      'module-alias/register': 'ModuleAlias'
    },
    target: 'node',

    // better stack traces in production errors, but slow builds
    devtool: 'source-map',

    output: {
      // output path is already dist somehow
      filename: `./${env.NODE_ENV}/server/app.js`
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            'ts-loader',
          ]
        }
      ]
    },
    plugins: [
      new webpack.BannerPlugin(banner)
    ]
  }
}
