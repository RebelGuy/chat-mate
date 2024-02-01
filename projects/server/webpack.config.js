const path = require('path')
const fs = require('fs')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals');
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const execSync = require('child_process').execSync

function parseBoolean (str) {
  return str === 'true' ? true : str === 'false' ? false : null
}

// add the version number to the top of the app.js file
const version = execSync('node ../../scripts/getVersion').toString()
const banner =  `${version} generated at ${new Date().toISOString()}`

module.exports = (env) => {
  // from `env` because it's injected
  const nodeEnv = env.NODE_ENV
  if (nodeEnv == null || nodeEnv === '') {
    throw new Error('The NODE_ENV variable must be injected when using webpack.')
  }

  require('dotenv').config({ path: `${nodeEnv}.env` })

  const isLocal = nodeEnv === 'local'
  const NAME = process.env.NAME ?? '' // env variable defined in CI (e.g. '74d8a7029d5c30e332fe59c075a42a75aa6deffd - push - master')
  const STUDIO_URL = process.env.STUDIO_URL
  const NOW = new Date()

  // special env variable passed to webpack during local development for faster building
  const skipTypeChecks = parseBoolean(env.SKIP_TYPE_CHECKS) ?? false
  if (skipTypeChecks) {
    console.log('Skipping type checks')
  }

  const skipTests = parseBoolean(env.SKIP_TESTS) ?? false
  if (skipTests) {
    console.log('Skipping tests')
  }

  const outPath = path.resolve(__dirname, `../../dist/server`)

  // note: path.resolve doesn't work with glob patterns
  /** @type CopyWebpackPlugin.Pattern[] */
  let copyPatterns = []

  // only copy the prisma engine file if it doesn't already exist, otherwise we get a crash if the server is currently running due to the file being locked
  if (!isLocal || !fs.existsSync(outPath) || !fs.readdirSync(outPath).find(file => file.includes('engine'))) {
    copyPatterns.push({
      // the file we are interested in has 'engine' in its name.
      // see https://www.prisma.io/docs/concepts/components/prisma-engines/query-engine
      from: '../../node_modules/.prisma/client/*engine*', // `query_engine-windows.dll.node` for windows
      to: path.resolve(outPath, './[name][ext]'), // place the file directly to the output directory instead of copying the directory tree, otherwise Prisma won't find it
    })
  }

  // similarly, only copy ngrok if it doesn't already exist
  const ngrokPath = path.resolve(outPath, '../bin') // it has to go here exactly, otherwise ngrok won't find it
  if (isLocal && (!fs.existsSync(ngrokPath) || !fs.readdirSync(ngrokPath).find(file => file.startsWith('ngrok')))) {
    const fileToCopy = findFileRecursively('../../node_modules/@ngrok', fileName => fileName.startsWith('ngrok.linux') || fileName === 'ngrok.exe')
    if (fileToCopy == null) {
      throw new Error('Could not find ngrok file to copy')
    }

    copyPatterns.push({
      from: fileToCopy,
      to: ngrokPath // folder is automatically created
    })
  }

  copyPatterns.push(...[  
    {
      // required for prisma to find the schema file
      // see https://github.com/prisma/prisma/issues/2303#issuecomment-768358529
      from: path.resolve(__dirname, '../../node_modules/.prisma/client/schema.prisma'),
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
  ])

  // for development purposes, we need to emit special javascript files, such as scripts, so we can run them separate from the main app.
  // the key for these will be used for the `[name]` placeholder in the `output` config of webpack.
  // these have to be placed in the root output folder, otherwise there is an issue where `schema.prisma` can't be found
  const additionalEntryFiles = isLocal ? {
    migrateSchema: './scripts/migrations/migrateSchema.ts',
    applySchemaMigrations: './scripts/migrations/applySchemaMigrations.ts',
    TwitchAuth: './scripts/TwitchAuth.ts',
    YoutubeAuth: './scripts/YoutubeAuth.ts',
    RefreshSnapshots: './scripts/RefreshSnapshots.ts',
    resetPassword: './scripts/resetPassword.ts'
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

        // these two config files are identical, except the webpack one excludes *.test.ts files in the build (don't ask)
        configFile: skipTests ? './tsconfig.webpack.json' : './tsconfig.json'
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
        "@rebel/masterchat": path.resolve(__dirname, '../../projects/masterchat/src'),
        "@rebel/studio": path.resolve(__dirname, '../../projects/studio'),
        "@rebel/shared": path.resolve(__dirname, '../../projects/shared'),
        "@rebel/api-models": path.resolve(__dirname, '../../projects/api-models'),
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

      // required otherwise it doesn't work lol. seems that it's because ngrok is `require()`ing the ngrok executables, which webpack doesn't like
      '@ngrok/ngrok': 'commonjs @ngrok/ngrok',

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
      devtoolModuleFilenameTemplate: (info) => {
        // sourcemaps to files in different projects in the app.js.map file reference the server project, so the javascript debugger can't load them
        // https://github.com/webpack/webpack/issues/3603
        const rel = path.relative(outPath, info.absoluteResourcePath)
        return `webpack:///${rel}`
      },
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
      new CopyWebpackPlugin({ patterns: copyPatterns }),

      new HtmlWebpackPlugin({
        filename: './default.html',
        template: './default.html',
        favicon: `./favicon_${nodeEnv}.ico`,
        chunks: [], // don't inject javascript
        version: version,
        buildDate: NOW.getTime(),
        buildName: NAME,
        studioUrl: STUDIO_URL
      })
    ]
  }
}

// returns the first file path + name that matched the predicate, if any
function findFileRecursively (pathToSearch, fileNamePredicate) {
  for (const item of fs.readdirSync(pathToSearch, { withFileTypes: true })) {
    const itemPath = item.path ?? pathToSearch

    console.log(itemPath, item.name)
    if (item.isDirectory()) {
      const result = findFileRecursively(path.join(itemPath, item.name), fileNamePredicate)
      if (result != null) {
        return result
      }
    } else {
      if (fileNamePredicate(item.name)) {
        return path.join(itemPath, item.name)
      }
    }
  }
}
