const path = require('path');
const base = require('../../jest.preset.cjs')(__dirname);
module.exports = {
  ...base,
  moduleNameMapper: { ...base.moduleNameMapper, '^@/(.*)$': path.join(__dirname, 'src/$1') },
};
