const fs = require('fs')
const path = require('path')
const webpack = require('webpack')

// add the version number to the top of the app.js file
const PACKAGE = require('./package.json');
const banner = PACKAGE.name + ' - ' + PACKAGE.version;

// webpack can't resolve the node_modules for some reason.
// hack from https://stackoverflow.com/a/47848010.
// until we figure out how to bundle dependencies, we copy the
// node_module folder to the output folder (see package.json script)
let nodeModules = {};
fs.readdirSync('dist/release/node_modules')
  .filter(function(x) {
    return ['.bin'].indexOf(x) === -1;
  })
  .forEach(function(mod) {
    nodeModules[mod] = 'commonjs ' + mod;
  });

module.exports = {
  mode: 'none', // opt out of automatic optimisations
  entry: './src/app.ts',
  resolve: {
    extensions: ['.ts'],
    modules: [path.resolve(__dirname, 'src'), 'dist/release/node_modules/'],
    alias: {
      "@rebel": path.resolve(__dirname, 'src')
    }
  },

  // required to resolve modules
  externals: {
    ...nodeModules,

    // we don't use it in release mode, but not marking it as an external here will cause a 'Module not found' error
    'module-alias/register': 'ModuleAlias'
  },
  target: 'node',

  output: {
    // output path is already dist somehow
    filename: './release/app.js'
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