ALTER TABLE "admin_settings"
ADD COLUMN IF NOT EXISTS "attributes_by_key" jsonb DEFAULT '{}'::jsonb;

ALTER TABLE "listings"
ADD COLUMN IF NOT EXISTS "attributes" jsonb DEFAULT '{}'::jsonb;

UPDATE "admin_settings"
SET "attributes_by_key" = '{}'::jsonb
WHERE "attributes_by_key" IS NULL;

UPDATE "listings"
SET "attributes" = '{}'::jsonb
WHERE "attributes" IS NULL;
