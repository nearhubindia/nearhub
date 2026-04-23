ALTER TABLE listings
ADD COLUMN IF NOT EXISTS main_category varchar(80);
--> statement-breakpoint
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS sub_category varchar(80);
--> statement-breakpoint
UPDATE listings
SET sub_category = NULLIF(BTRIM(category), '')
WHERE (sub_category IS NULL OR BTRIM(sub_category) = '')
  AND BTRIM(COALESCE(category, '')) <> '';
--> statement-breakpoint
UPDATE listings
SET main_category = COALESCE(NULLIF(BTRIM(sub_category), ''), NULLIF(BTRIM(category), ''))
WHERE (main_category IS NULL OR BTRIM(main_category) = '')
  AND (
    BTRIM(COALESCE(sub_category, '')) <> ''
    OR BTRIM(COALESCE(category, '')) <> ''
  );
--> statement-breakpoint
UPDATE listings
SET category = sub_category
WHERE BTRIM(COALESCE(category, '')) = ''
  AND BTRIM(COALESCE(sub_category, '')) <> '';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_listings_main_category_created
ON listings (main_category, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_listings_sub_category_created
ON listings (sub_category, created_at DESC);
