-- Persist user latitude/longitude for radius-based targeting and push notifications.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS latitude real,
ADD COLUMN IF NOT EXISTS longitude real;
