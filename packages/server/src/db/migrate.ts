import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { MAPS } from '@maze/shared';

function migrationsDir(): string {
  const cwd = process.cwd();
  const candidates = [
    process.env.MIGRATIONS_DIR,
    path.join(cwd, 'src/db/migrations'),
    path.join(cwd, 'packages/server/src/db/migrations'),
  ].filter((d): d is string => !!d);
  for (const dir of candidates) if (fs.existsSync(dir)) return dir;
  throw new Error('migrations directory not found');
}

/** Applies pending `NNN_name.sql` files in order (one transaction each), then upserts built-in maps. */
export async function migrate(pool: pg.Pool): Promise<string[]> {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
  );
  const applied = new Set(
    (await pool.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
  );
  const dir = migrationsDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      ran.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  for (const map of Object.values(MAPS)) {
    await pool.query(
      `INSERT INTO maps (id, name, width, height, cells, spawns, goal) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET name = $2, width = $3, height = $4, cells = $5, spawns = $6, goal = $7`,
      [
        map.id,
        map.name,
        map.width,
        map.height,
        JSON.stringify(map.cells),
        JSON.stringify(map.spawns),
        JSON.stringify(map.goal),
      ],
    );
  }
  return ran;
}
