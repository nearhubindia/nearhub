import { sql } from 'drizzle-orm';
import { db } from './db';

let ensureCoreSchemaPromise: Promise<void> | null = null;

async function applyCoreSchemaPatches(): Promise<void> {
  // Users profile columns required by auth/profile/listings flows.
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile varchar(20)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS address text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gstin text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`);
  await db.execute(
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false`
  );
  await db.execute(sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_at timestamp`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id varchar,
      seller_id varchar NOT NULL,
      amount numeric(12, 2) NOT NULL DEFAULT 0,
      payment_status text NOT NULL DEFAULT 'pending',
      payment_id varchar,
      order_id varchar,
      razorpay_data text,
      failure_reason text,
      refund_id varchar,
      refund_status text,
      refunded_at timestamp,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at timestamp
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS listing_likes (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id varchar NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS listing_likes_listing_user_unique
      ON listing_likes (listing_id, user_id)
  `);

  // Keep display_name useful when legacy rows only had username.
  await db.execute(sql`
    UPDATE users
    SET display_name = username
    WHERE COALESCE(btrim(display_name), '') = ''
      AND COALESCE(btrim(username), '') <> ''
      AND NOT (username ~ '^[0-9]{10,15}$')
  `);
}

export function ensureCoreSchema(): Promise<void> {
  if (!ensureCoreSchemaPromise) {
    ensureCoreSchemaPromise = applyCoreSchemaPatches()
      .then(() => {
        console.log('[DB] Core schema verified');
      })
      .catch((error) => {
        ensureCoreSchemaPromise = null;
        throw error;
      });
  }
  return ensureCoreSchemaPromise;
}
