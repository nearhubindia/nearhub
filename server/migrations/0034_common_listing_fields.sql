ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS listing_common_field_assignments jsonb;
