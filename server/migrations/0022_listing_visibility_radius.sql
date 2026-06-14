ALTER TABLE "listings"
ADD COLUMN IF NOT EXISTS "visibility_mode" varchar(20) NOT NULL DEFAULT 'local';

ALTER TABLE "listings"
ADD COLUMN IF NOT EXISTS "visibility_radius_km" integer;
