/**
 * Migration Utility
 * Handles database migrations using Drizzle ORM
 *
 * Usage:
 *   npx ts-node scripts/migrate.ts [command]
 *
 * Commands:
 *   generate   - Generate new migration files from schema changes
 *   push       - Apply pending migrations to database
 *   status     - Show migration status
 *   create     - Create coupons table manually (fallback)
 *   help       - Show this help message
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nearhub';

interface MigrationResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Create database connection
 */
async function createConnection(): Promise<Pool> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return pool;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Create coupons and coupon_usage tables
 */
async function createCouponsTables(): Promise<MigrationResult> {
  try {
    const pool = await createConnection();

    const sql = `
      -- Create coupons table
      CREATE TABLE IF NOT EXISTS coupons (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) NOT NULL UNIQUE,
        discount_percentage INTEGER NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
        max_usage_count INTEGER NOT NULL CHECK (max_usage_count > 0),
        usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP,
        created_by VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create coupon_usage table
      CREATE TABLE IF NOT EXISTS coupon_usage (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        coupon_id VARCHAR NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
        listing_id VARCHAR NOT NULL,
        subscription_id VARCHAR NOT NULL,
        discount_amount DECIMAL(12,2) NOT NULL,
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
      CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
      CREATE INDEX IF NOT EXISTS idx_coupons_expires_at ON coupons(expires_at DESC);
      CREATE INDEX IF NOT EXISTS idx_coupons_created_at ON coupons(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON coupon_usage(coupon_id);
      CREATE INDEX IF NOT EXISTS idx_coupon_usage_listing_id ON coupon_usage(listing_id);
      CREATE INDEX IF NOT EXISTS idx_coupon_usage_subscription_id ON coupon_usage(subscription_id);
      CREATE INDEX IF NOT EXISTS idx_coupon_usage_used_at ON coupon_usage(used_at DESC);
    `;

    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }

    await pool.end();

    return {
      success: true,
      message: '✅ Coupons tables created successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      message: '❌ Failed to create coupons tables',
      error: error.message,
    };
  }
}

/**
 * Check migration status
 */
async function checkStatus(): Promise<MigrationResult> {
  try {
    const pool = await createConnection();

    // Check if tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('coupons', 'coupon_usage')
      ORDER BY table_name;
    `);

    await pool.end();

    const tables = result.rows.map((r: any) => r.table_name);
    const message =
      tables.length === 0
        ? '❌ No coupon tables found. Run: npx ts-node scripts/migrate.ts create'
        : `✅ Found tables: ${tables.join(', ')}`;

    return {
      success: tables.length > 0,
      message,
    };
  } catch (error: any) {
    return {
      success: false,
      message: '❌ Failed to check migration status',
      error: error.message,
    };
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
📚 Database Migration Utility

Usage:
  npx ts-node scripts/migrate.ts [command]

Commands:
  create    - Create coupons tables (recommended)
  status    - Check if tables exist
  generate  - Generate migrations from schema
  push      - Apply migrations to database
  help      - Show this help message

Examples:
  npx ts-node scripts/migrate.ts create
  npx ts-node scripts/migrate.ts status
  npx ts-node scripts/migrate.ts generate
  npx ts-node scripts/migrate.ts push

Environment:
  DATABASE_URL - PostgreSQL connection string
                 Default: postgresql://postgres:postgres@localhost:5432/nearhub
  `);
}

/**
 * Main entry point
 */
async function main() {
  const command = process.argv[2] || 'help';

  console.log(`\n🚀 Migration Utility - Command: ${command}\n`);

  let result: MigrationResult;

  switch (command) {
    case 'create':
      result = await createCouponsTables();
      break;

    case 'status':
      result = await checkStatus();
      break;

    case 'generate':
      console.log('📝 Running: drizzle-kit generate');
      console.log('   Run: npm run db:generate\n');
      result = {
        success: true,
        message: "Use 'npm run db:generate' to generate migrations",
      };
      break;

    case 'push':
      console.log('📤 Running: drizzle-kit push');
      console.log('   Run: npm run db:push\n');
      result = {
        success: true,
        message: "Use 'npm run db:push' to apply migrations",
      };
      break;

    case 'help':
      showHelp();
      return;

    default:
      console.log(`❌ Unknown command: ${command}\n`);
      showHelp();
      return;
  }

  console.log(`\n${result.message}`);
  if (result.error) {
    console.log(`Error details: ${result.error}`);
  }
  console.log();

  process.exit(result.success ? 0 : 1);
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
