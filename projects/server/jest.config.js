// https://huafu.github.io/ts-jest/user/config
// example: https://github.com/ghiscoding/slickgrid-universal/blob/master/test/jest.config.js
module.exports = {
  rootDir: './',
  preset: 'ts-jest',
  testRegex: '(test|spec)\\.ts',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js'],
  globals: {
    'ts-jest': {
      diagnostics: false,
      isolatedModules: true,
      tsconfig: '<rootDir>/tsconfig.json',
      stringifyContentPathRegex: '\\.html$'
    },
  },}
