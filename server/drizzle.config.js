const dotenv = require('dotenv');
const path = require('path');

// Load server-level environment file
dotenv.config({ path: path.resolve(__dirname, '.env') });

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nearhub';

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set in environment or .env file');
}

/** @type {import('drizzle-kit').Config} */
const config = {
  out: './migrations',
  schema: ['./features/admin/models/admin-settings.ts', './features/users/models/users.ts'],
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: false,
};

module.exports = config;
