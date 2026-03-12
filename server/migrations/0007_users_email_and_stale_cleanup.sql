-- Add persistent email field and remove legacy/stale user ids.
-- Safe to run multiple times.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email text;

-- Normalize blanks.
UPDATE users SET email = NULL WHERE email IS NOT NULL AND btrim(email) = '';
UPDATE users SET mobile = NULL WHERE mobile IS NOT NULL AND btrim(mobile) = '';

-- No backward compatibility needed: remove legacy user rows.
DELETE FROM users
WHERE id IS NULL
   OR btrim(id) = ''
   OR id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   OR username LIKE '%__legacy__%';

