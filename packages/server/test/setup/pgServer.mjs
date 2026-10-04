// Child process: boots an embedded Postgres and prints its URL. Killed by globalTeardown.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maze-pg-'));
const port = 55000 + Math.floor(Math.random() * 5000);
const epg = new EmbeddedPostgres({ databaseDir: dir, user: 'test', password: 'test', port, persistent: false, onLog: () => {} });
await epg.initialise();
await epg.start();
await epg.createDatabase('maze_test');
console.log(`READY postgres://test:test@localhost:${port}/maze_test`);
const stop = async () => {
  await epg.stop();
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
