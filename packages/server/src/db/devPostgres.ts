/**
 * Local Postgres without Docker (uses the `embedded-postgres` npm binaries).
 * Matches DATABASE_URL in .env.example: postgres://user:pass@localhost:5432/maze_defense
 * Run: npm run db:start   (Ctrl+C to stop; data persists in .pgdata/)
 */
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(process.cwd(), '../..');
const dataDir = path.join(root, '.pgdata');
const port = Number(process.env.PGPORT ?? 5432);
const fresh = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));

function portInUse(p: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port: p, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

// Never touch a server that is already running: embedded-postgres stops the cluster in `dataDir` when this
// process exits, which would kill an instance started from another terminal.
if (await portInUse(port)) {
  console.log(`Something is already listening on :${port} — assuming Postgres is running. Nothing to do.`);
  process.exit(0);
}

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'user',
  password: 'pass',
  port,
  persistent: true,
});
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('maze_defense');
console.log(`Postgres running on :${port} (data: ${dataDir}). Ctrl+C to stop.`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
