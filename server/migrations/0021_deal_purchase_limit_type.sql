ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS purchase_limit_type varchar(20);

