const dotenv = require('dotenv');
const path = require('path');

// Load from parent directory (.env is at root of monorepo)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nearhub';

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set in environment or .env file');
}

/** @type {import('drizzle-kit').Config} */
const config = {
  out: './migrations',
  schema: [
    './features/admin/models/admin-settings.ts',
    './features/users/models/users.ts',
    './features/subscriptions/models/subscription.ts',
  ],
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: false,
};

module.exports = config;
