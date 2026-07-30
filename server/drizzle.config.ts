import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const config = {
  out: './migrations',
  schema: ['./features/admin/models/admin-settings.ts', './features/users/models/users.ts'],
  dialect: 'postgresql' as const,
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nearhub',
  },
  verbose: true,
  strict: false,
};

export default config;
