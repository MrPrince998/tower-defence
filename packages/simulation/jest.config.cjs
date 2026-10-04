const base = require('../../jest.preset.cjs')(__dirname);
module.exports = {
  ...base,
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/flowField.ts'],
  coverageThreshold: { global: { statements: 90, branches: 85, functions: 90, lines: 90 } },
  coverageReporters: ['text-summary'],
};
