// Provides TEST_DATABASE_URL for repository tests: CI sets it; locally we boot embedded Postgres.
const { spawn } = require('node:child_process');
const path = require('node:path');

module.exports = async () => {
  if (process.env.TEST_DATABASE_URL) return;
  const child = spawn(process.execPath, [path.join(__dirname, 'pgServer.mjs')], { stdio: ['ignore', 'pipe', 'inherit'] });
  globalThis.__PG_CHILD__ = child;
  process.env.TEST_DATABASE_URL = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('embedded postgres did not start in 90s')), 90_000);
    child.stdout.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/READY (\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    child.on('exit', (code) => reject(new Error(`embedded postgres exited with ${code}`)));
  });
};
