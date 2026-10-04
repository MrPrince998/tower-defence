import pg from 'pg';
import { config } from './config';
import { createGameServer } from './createServer';
import { migrate } from './db/migrate';
import { createMemoryRepositories } from './db/repositories/memory';
import { createPgRepositories } from './db/repositories/pg';
import type { Repositories } from './db/repositories/types';
import { logger } from './logger';

async function connectRepositories(): Promise<Repositories> {
  if (!config.databaseUrl) {
    logger.warn('DATABASE_URL not set: using the in-memory store (accounts and matches are lost on restart)');
    return createMemoryRepositories();
  }
  const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
  try {
    const ran = await migrate(pool);
    if (ran.length) logger.info({ migrations: ran }, 'migrations applied');
    return createPgRepositories(pool);
  } catch (err) {
    await pool.end().catch(() => {});
    if (config.isProd) throw err;
    logger.error(
      { err: (err as Error).message },
      'Postgres unavailable: falling back to the in-memory store. Start one with `npm run db:start` or `docker compose up -d`.',
    );
    return createMemoryRepositories();
  }
}

const repos = await connectRepositories();
const server = createGameServer({
  repos,
  jwtSecret: config.jwtSecret,
  clientOrigins: config.clientOrigins,
  bcryptCost: config.bcryptCost,
});

server.io.on('connection', (socket) =>
  logger.info({ socketId: socket.id, user: socket.data.name }, 'client connected'),
);

server.httpServer.listen(config.port, () => {
  logger.info({ port: config.port, db: repos.kind, origins: config.clientOrigins }, 'server listening');
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutting down');
  await server.close();
  await repos.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
