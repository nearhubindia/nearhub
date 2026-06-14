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
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude real`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude real`);
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
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_deal boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_type varchar(20)`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_start_at timestamp`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_end_at timestamp`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_recurrence varchar(20) NOT NULL DEFAULT 'none'`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_recurrence_until timestamp`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_cycle_quantity integer`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_last_cycle_key varchar(40)`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS max_deal_bookings integer`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_bookings_used integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS combo_items text`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_terms text`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS voucher_enabled boolean NOT NULL DEFAULT true`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS visibility_mode varchar(20) NOT NULL DEFAULT 'local'`);
  await db.execute(sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS visibility_radius_km integer`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS deal_bookings (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id varchar NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      deal_cycle_key varchar(40),
      buyer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status varchar(20) NOT NULL DEFAULT 'booked',
      voucher_code varchar(64) NOT NULL UNIQUE,
      voucher_payload text,
      booked_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      redeemed_at timestamp,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(sql`ALTER TABLE deal_bookings ADD COLUMN IF NOT EXISTS deal_cycle_key varchar(40)`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS deal_bookings_buyer_idx
      ON deal_bookings (buyer_id, created_at DESC)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS deal_bookings_listing_idx
      ON deal_bookings (listing_id, created_at DESC)
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS listing_likes_listing_user_unique
      ON listing_likes (listing_id, user_id)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS listing_moderation_queue (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id varchar NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      status varchar(20) NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0,
      max_attempts integer NOT NULL DEFAULT 5,
      confidence numeric(5, 4),
      reasons text,
      last_error text,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at timestamp
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS listing_moderation_queue_listing_id_unique
      ON listing_moderation_queue (listing_id)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_voiceover_jobs (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_video_url text NOT NULL,
      output_video_url text,
      language varchar(20) NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'pending',
      script_text text,
      error_message text,
      attempts integer NOT NULL DEFAULT 0,
      max_attempts integer NOT NULL DEFAULT 3,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at timestamp
    )
  `);
  await db.execute(sql`ALTER TABLE ai_voiceover_jobs ADD COLUMN IF NOT EXISTS title_text text`);
  await db.execute(
    sql`ALTER TABLE ai_voiceover_jobs ADD COLUMN IF NOT EXISTS highlights_text text`
  );
  await db.execute(
    sql`ALTER TABLE ai_voiceover_jobs ADD COLUMN IF NOT EXISTS description_text text`
  );
  await db.execute(
    sql`ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS listing_price_units jsonb`
  );

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
