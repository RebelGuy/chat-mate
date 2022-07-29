const path = require('path')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals');
const CopyWebpackPlugin = require('copy-webpack-plugin')
const WebpackShellPluginNext = require('webpack-shell-plugin-next')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const loaded = require('dotenv').config() // loads the .env file generated during the Github Actions process
const execSync = require('child_process').execSync

function parseBoolean (str) {
  return str === 'true' ? true : str === 'false' ? false : null
}

// add the version number to the top of the app.js file
const PACKAGE = require('./package.json')
const currentCommit = execSync(`git rev-parse --short HEAD`).toString().trim()
const numCommits = execSync(`git rev-list ${currentCommit} --count`).toString().trim()
const versionParts = PACKAGE.version.split('.')
versionParts[2] = `${numCommits}`
const version = versionParts.join('.')
const banner =  `${PACKAGE.name} - ${version} generated at ${new Date().toISOString()}`

module.exports = (env) => {
  env['BUILD'] = 'webpack'

  // the following env variables are defined in the Github Actions
  const isLocal = parseBoolean(process.env.IS_LOCAL) ?? parseBoolean(env.IS_LOCAL) ?? false
  const nodeEnv = env.NODE_ENV ?? 'debug'
  const NAME = process.env.NAME ?? ''
  const NOW = new Date()

  // special env variable passed to webpack during local development for faster building
  const skipTypeChecks = parseBoolean(env.SKIP_TYPE_CHECKS) ?? false

  const outPath = path.resolve(__dirname, `../../dist/server`)

  // note: path.resolve doesn't work with glob patterns
  /** @type CopyWebpackPlugin.Pattern[] */
  const copyPatters = [
    {
      // the file we are interested in has 'engine' in its name.
      // see https://www.prisma.io/docs/concepts/components/prisma-engines/query-engine
      from: './node_modules/.prisma/client/*engine*', // `query_engine-windows.dll.node` for windows
      to: path.resolve(outPath, './[name][ext]'), // place the file directly to the output directory instead of copying the directory tree, otherwise Prisma won't find it
    },
    {
      // required for prisma to find the schema file
      // see https://github.com/prisma/prisma/issues/2303#issuecomment-768358529
      from: path.resolve(__dirname, './node_modules/.prisma/client/schema.prisma'),
      to: outPath,
    },
    {
      from: path.resolve(__dirname, './key.pem'),
      to: outPath
    },
    {
      from: path.resolve(__dirname, './certificate.pem'),
      to: outPath
    },
    { from: path.resolve(__dirname, './robots.txt'),
      to: outPath
    },
    { from: path.resolve(__dirname, `./favicon_${nodeEnv}.ico`),
      to: outPath
    }
  ]

  if (isLocal) {
    copyPatters.push({
      from: path.resolve(__dirname, '../../node_modules/ngrok/bin'), // `ngrok.exe` for windows
      to: path.resolve(outPath, '../bin') // it has to go here exactly, otherwise ngrok won't find it (folder is automatically created)
    })
  }

  // for development purposes, we need to emit special javascript files, such as scripts, so we can run them separate from the main app.
  // the key for these will be used for the `[name]` placeholder in the `output` config of webpack.
  // these have to be placed in the root output folder, otherwise there is an issue where `schema.prisma` can't be found
  const additionalEntryFiles = isLocal ? {
    migrateSchema: './scripts/migrations/migrateSchema.ts',
    applySchemaMigrations: './scripts/migrations/applySchemaMigrations.ts',
    TwitchAuth: './scripts/TwitchAuth.ts',
    RefreshSnapshots: './scripts/RefreshSnapshots.ts'
  } : {}

  // skip type checking
  let typescriptLoader
  if (skipTypeChecks) {
    console.log('Skipping type checks - use `yarn workspace server watch:check` to enable type checking')
    typescriptLoader = {
      loader: "swc-loader",
      // instead of using a .swcrc file, we can set the options in here directly
      // more options: https://swc.rs/docs/configuration/compilation
      options: {
        jsc: {
          parser: {
            syntax: "typescript",
            decorators: true,
            dynamicImport: true
          },
          // `decorators: true` will cause a successful compilation, but there will be runtime errors.
          // enabling these transformations fixes things
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true
          }
        },
        module: {
          // required to fix masterchat export issues
          type: 'commonjs'
        }
      }
    }
  } else {
    typescriptLoader = { 
      loader: 'ts-loader',
      options: {
        // this is the equivalent of adding the --build flag to tsc.
        // see https://medium.com/@nickexcell/using-typescript-project-references-with-ts-loader-and-webpack-part-1-5d0c3cd7c603
        projectReferences: true,
      }
    }
  }

  return {
    // this opts out of automatic optimisations - do NOT set this to production as the app
    // will crash and the error message is so big it lags out everything
    mode: 'none',
    entry: {
      ...additionalEntryFiles,
      app: './app.ts'
    },
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
      'bufferutil': 'bufferutil',

      // webpack is unable to find some modules required by applicationinsights, but everything seems to work fine so make it shut up 
      'applicationinsights-native-metrics': 'commonjs applicationinsights-native-metrics',
      '@azure/opentelemetry-instrumentation-azure-sdk': 'commonjs @azure/opentelemetry-instrumentation-azure-sdk',
      '@opentelemetry/instrumentation': 'commonjs @opentelemetry/instrumentation',
      '@azure/identity-vscode': 'commonjs @azure/identity-vscode',

      electron: 'require("electron")'
    },
    target: 'node',

    // better stack traces in production errors, but slow builds.
    // no point doing this when we aren't transpiling typescript
    devtool: skipTypeChecks ? false : 'source-map',

    ignoreWarnings: [/Critical dependency: the request of a dependency is an expression/],

    watchOptions: isLocal ? {
      poll: 1000,
      aggregateTimeout: 500,
      ignored: ['**/node_modules', '**/dist']
    } : {},

    output: {
      path: outPath,
      // map each named entry .ts file to its corresponding .js output file
      filename: `[name].js`
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: typescriptLoader
        }
      ]
    },
    plugins: [
      new webpack.BannerPlugin(banner),

      // https://webpack.js.org/plugins/copy-webpack-plugin/
      new CopyWebpackPlugin({ patterns: copyPatters }),

      new HtmlWebpackPlugin({
        filename: './default.html',
        template: './default.html',
        favicon: `./favicon_${nodeEnv}.ico`,
        chunks: [], // don't inject javascript
        version: version,
        date: NOW.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour12: false }),
        build: NAME,
      })
    ]
  }
}
