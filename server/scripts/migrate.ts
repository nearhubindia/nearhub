import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const envFile = process.env.NEARHUB_ENV_FILE || '/etc/nearhub/server.env';
const candidates = [envFile, path.resolve(process.cwd(), '.env')];
const selected = candidates.find((candidate) => fs.existsSync(candidate));
if (selected) loadEnv({ path: selected });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run migrations');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(drizzle(pool), { migrationsFolder: path.resolve(process.cwd(), 'migrations') });
  console.log('[Migrate] Migrations applied successfully');
} finally {
  await pool.end();
}
