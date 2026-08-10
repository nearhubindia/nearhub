ALTER TABLE master_listing_units
  ADD COLUMN IF NOT EXISTS subcategory_id varchar
  REFERENCES master_listing_subcategories(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS master_listing_units_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS master_listing_units_subcategory_name_unique
  ON master_listing_units (subcategory_id, name);
