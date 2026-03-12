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
