const base = require('../../jest.preset.cjs')(__dirname);
module.exports = {
  ...base,
  testTimeout: 30000,
  globalSetup: '<rootDir>/test/setup/globalSetup.cjs',
  globalTeardown: '<rootDir>/test/setup/globalTeardown.cjs',
};
