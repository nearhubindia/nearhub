/**
 * Database Connection
 * Drizzle ORM setup for PostgreSQL
 *
 * NOTE: ESM hoists all `import` declarations before any top-level code runs,
 * so we must load dotenv via a pre-loaded env module and then read
 * process.env directly (not via SERVER_CONFIG which is already frozen).
 */

import './env';                   // side-effect: loads .env.local / .env
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as adminSchema from "../features/admin/models/admin-settings";
import { users } from "../features/users/models/users";

// Read env AFTER dotenv has run (env module was imported first)
const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nearhub';
const maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS || '50', 10);
const minConnections = parseInt(process.env.DB_MIN_CONNECTIONS || '10', 10);
const idleTimeoutMs = parseInt(process.env.DB_IDLE_TIMEOUT_MS || '60000', 10);
const connectionTimeoutMs = parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10);

console.log(`[DB] Connecting to: ${databaseUrl.substring(0, 50)}...`);
console.log(`[DB] Pool config: max=${maxConnections}, min=${minConnections}, idle=${idleTimeoutMs}ms`);

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: databaseUrl,
  max: maxConnections,
  min: minConnections,
  idleTimeoutMillis: idleTimeoutMs,
  connectionTimeoutMillis: connectionTimeoutMs,
});

// Create Drizzle instance
const schema = { ...adminSchema, users };
export const db = drizzle(pool, { schema });

