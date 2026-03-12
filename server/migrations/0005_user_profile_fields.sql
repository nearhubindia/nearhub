ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gstin" text;

UPDATE "users"
SET "display_name" = "username"
WHERE ("display_name" IS NULL OR btrim("display_name") = '')
  AND "username" IS NOT NULL
  AND btrim("username") <> '';
