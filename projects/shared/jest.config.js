// https://huafu.github.io/ts-jest/user/config
// example: https://github.com/ghiscoding/slickgrid-universal/blob/master/test/jest.config.js
module.exports = {
  rootDir: './',
  preset: 'ts-jest',
  testRegex: '(test|spec)\\.ts',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    // tell ts-jest how to resolve the path alias
    // https://github.com/kulshekhar/ts-jest/issues/2709
    '@rebel/shared/(.*)$': '<rootDir>/$1',
    '@rebel/api-models/(.*)$': '<rootDir>/../api-models/$1',
  },
  transform: {
    '.ts': ['ts-jest', {
      diagnostics: false,
      isolatedModules: true,
      tsconfig: '<rootDir>/tsconfig.json',
      stringifyContentPathRegex: '\\.html$'
    }]
  }
}
