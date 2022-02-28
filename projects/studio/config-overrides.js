// this is for configuring the `react-app-rewired` package. why? because the vanilla `react-scripts` have presets that don't work with our project setup.

const path = require('path')

module.exports = function override(config) {
  config.resolve = {
    ...config.resolve,

    // react-scripts don't support path aliasing. oddly, VSCode was also having issues until this config file was added.
    alias: {
      '@rebel/studio': path.resolve(__dirname, './src'),
      '@rebel/server': path.resolve(__dirname, '../server')
    },
  }

  return config
}
