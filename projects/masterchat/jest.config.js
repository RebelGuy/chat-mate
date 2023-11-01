module.exports = {
  preset: "ts-jest/presets/default-esm",
  testPathIgnorePatterns: ["lib"],
  moduleNameMapper: {
    '@rebel/(.*)$': '<rootDir>/../$1',
  },
  globals: {
    "ts-jest": {
      tsconfig: "./tsconfig.json",
      useESM: true,
    },
  },
};
