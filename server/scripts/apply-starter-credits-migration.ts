/**
 * Add starter credits columns/table.
 * Run with: npx tsx server/scripts/apply-starter-credits-migration.ts
 */

import { db } from '../data/db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('[Migration] Starting starter credits migration...');

  try {
    await db.execute(sql`
      ALTER TABLE admin_settings
      ADD COLUMN IF NOT EXISTS starter_credits_enabled BOOLEAN NOT NULL DEFAULT TRUE
    `);
    await db.execute(sql`
      ALTER TABLE admin_settings
      ADD COLUMN IF NOT EXISTS starter_listings_count INTEGER NOT NULL DEFAULT 2
    `);
    await db.execute(sql`
      ALTER TABLE admin_settings
      ADD COLUMN IF NOT EXISTS starter_boosts_count INTEGER NOT NULL DEFAULT 2
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_starter_credits (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL UNIQUE,
        listings_total INTEGER NOT NULL DEFAULT 0,
        listings_used INTEGER NOT NULL DEFAULT 0,
        boosts_total INTEGER NOT NULL DEFAULT 0,
        boosts_used INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        granted_by VARCHAR(40) NOT NULL DEFAULT 'system',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_user_starter_credits_user_id ON user_starter_credits(user_id)`
    );

    console.log('[Migration] ✅ Starter credits migration completed');
  } catch (error) {
    console.error('[Migration] ❌ Starter credits migration failed:', error);
    process.exitCode = 1;
  }
}

void run();
