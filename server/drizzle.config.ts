import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load server-level environment file
dotenv.config({ path: path.resolve(__dirname, '.env') });

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nearhub';

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set in environment or .env file');
}

const config: Config = {
  out: './migrations',
  schema: [
    './features/admin/models/admin-settings.ts',
    './features/users/models/users.ts',
  ],
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: false,
};

export default config;
