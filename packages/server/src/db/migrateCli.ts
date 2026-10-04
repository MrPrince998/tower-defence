// `npm run db:migrate`
import pg from 'pg';
import { config } from '../config';
import { migrate } from './migrate';

if (!config.databaseUrl) throw new Error('DATABASE_URL is not set');
const pool = new pg.Pool({ connectionString: config.databaseUrl });
const ran = await migrate(pool);
console.log(ran.length ? `applied: ${ran.join(', ')}` : 'database up to date');
await pool.end();
