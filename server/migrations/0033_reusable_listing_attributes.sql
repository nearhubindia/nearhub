ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS listing_attribute_catalog jsonb,
  ADD COLUMN IF NOT EXISTS listing_attribute_assignments_by_key jsonb;
