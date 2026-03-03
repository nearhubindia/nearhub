/**
 * Apply coupon per-user tracking migration
 * Run with: npx tsx server/scripts/apply-coupon-user-migration.ts
 */

import '../data/env';
import { Pool } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:Synvide%40123@localhost:5432/postgres';

async function applyMigration(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 5000,
  });

  try {
    console.log('[Migration] Starting coupon per-user tracking migration...\n');

    const client = await pool.connect();

    try {
      // Add user_id column to coupon_usage table
      console.log('[Migration] Adding user_id column to coupon_usage table...');
      await client.query(`
        ALTER TABLE coupon_usage 
        ADD COLUMN IF NOT EXISTS user_id VARCHAR NOT NULL DEFAULT 'unknown'
      `);
      console.log('[Migration] ✅ user_id column added\n');

      // Create index for efficient user+coupon lookups
      console.log('[Migration] Creating index on (user_id, coupon_id)...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_coupon 
        ON coupon_usage(user_id, coupon_id)
      `);
      console.log('[Migration] ✅ Index created\n');

      // Create index on user_id for analytics queries
      console.log('[Migration] Creating index on user_id...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id 
        ON coupon_usage(user_id)
      `);
      console.log('[Migration] ✅ Index created\n');

      console.log('[Migration] 🎉 Migration completed successfully!');
      console.log('[Migration] Coupons are now restricted to one use per user.');
    } finally {
      client.release();
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('[Migration] ❌ Error applying migration:', error);
    await pool.end();
    process.exit(1);
  }
}

applyMigration();
