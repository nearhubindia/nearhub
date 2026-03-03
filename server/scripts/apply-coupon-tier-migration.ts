/**
 * Apply coupon plan restrictions migration
 * Run with: npx tsx server/scripts/apply-coupon-tier-migration.ts
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
    console.log('[Migration] Starting coupon plan restrictions migration...\n');

    const client = await pool.connect();

    try {
      // Add applicable_tiers column to coupons table
      console.log('[Migration] Adding applicable_tiers column to coupons table...');
      await client.query(`
        ALTER TABLE coupons 
        ADD COLUMN IF NOT EXISTS applicable_tiers TEXT
      `);
      console.log('[Migration] ✅ applicable_tiers column added\n');

      console.log('[Migration] 🎉 Migration completed successfully!');
      console.log('[Migration] Coupons can now be restricted to specific subscription plans.');
      console.log('[Migration] - NULL = Applicable to all plans');
      console.log('[Migration] - JSON array = Restricted to specific tier IDs');
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
