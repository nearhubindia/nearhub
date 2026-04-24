-- Allow service-style listings to omit product condition values.
ALTER TABLE listings
ALTER COLUMN condition DROP NOT NULL;
