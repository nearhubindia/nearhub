ALTER TABLE master_listing_categories
  ADD COLUMN IF NOT EXISTS icon_url text;

ALTER TABLE master_listing_subcategories
  ADD COLUMN IF NOT EXISTS icon_url text;
