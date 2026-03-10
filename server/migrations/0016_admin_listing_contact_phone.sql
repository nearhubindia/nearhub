-- Ensure admin listing contact/sponsored fields exist in all environments
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS contact_phone varchar(20);

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS sponsored boolean NOT NULL DEFAULT false;
