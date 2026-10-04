// Shared Jest settings: TS sources compiled to CJS by ts-jest; workspace packages resolved to src.
const path = require('path');

module.exports = (dir) => ({
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'].filter((p) =>
    require('fs').existsSync(p.replace('<rootDir>', dir)),
  ),
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: path.join(__dirname, 'tsconfig.jest.json'), diagnostics: { warnOnly: false } },
    ],
  },
  moduleNameMapper: {
    '^@maze/shared$': path.join(__dirname, 'packages/shared/src/index.ts'),
    '^@maze/simulation$': path.join(__dirname, 'packages/simulation/src/index.ts'),
  },
});
