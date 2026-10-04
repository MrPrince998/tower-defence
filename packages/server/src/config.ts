import fs from 'node:fs';
import path from 'node:path';

for (const candidate of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')]) {
  if (fs.existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000').split(',').map((s) => s.trim()),
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),
  logLevel: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
};

if (isProd && config.jwtSecret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}
