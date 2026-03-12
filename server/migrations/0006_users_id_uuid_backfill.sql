-- Convert legacy non-UUID users.id values to UUIDs and remap all FK references.
-- Safe to run multiple times.

DO $$
DECLARE
  uuid_regex CONSTANT text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  legacy_count integer := 0;
  row_count bigint := 0;
  fk record;
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  CREATE TEMP TABLE user_id_migration (
    old_id text PRIMARY KEY,
    new_id text NOT NULL UNIQUE,
    old_username text,
    old_mobile text
  ) ON COMMIT DROP;

  INSERT INTO user_id_migration (old_id, new_id, old_username, old_mobile)
  SELECT
    u.id,
    gen_random_uuid()::text,
    u.username,
    u.mobile
  FROM users u
  WHERE u.id IS NOT NULL
    AND btrim(u.id) <> ''
    AND btrim(u.id) !~* uuid_regex;

  GET DIAGNOSTICS legacy_count = ROW_COUNT;
  IF legacy_count = 0 THEN
    RAISE NOTICE '[UUID migration] No legacy non-UUID users found';
    RETURN;
  END IF;

  RAISE NOTICE '[UUID migration] Found % legacy users to migrate', legacy_count;

  -- Keep existing usernames free for new UUID user rows.
  UPDATE users u
  SET username = CONCAT(u.username, '__legacy__', substr(m.new_id, 1, 8))
  FROM user_id_migration m
  WHERE u.id = m.old_id;

  -- Free unique mobile values before inserting UUID user rows.
  UPDATE users u
  SET mobile = NULL
  FROM user_id_migration m
  WHERE u.id = m.old_id;

  -- Create canonical UUID user rows with original profile fields.
  INSERT INTO users (
    id,
    username,
    display_name,
    password,
    mobile,
    address,
    gstin,
    location,
    avatar_url,
    is_verified,
    created_at
  )
  SELECT
    m.new_id,
    m.old_username,
    u.display_name,
    u.password,
    u.mobile,
    u.address,
    u.gstin,
    u.location,
    u.avatar_url,
    COALESCE(u.is_verified, false),
    u.created_at
  FROM users u
  JOIN user_id_migration m ON m.old_id = u.id;

  -- Rewrite every FK column that references users(id).
  FOR fk IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'users'::regclass
      AND array_length(con.conkey, 1) = 1
      AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I t
       SET %I = m.new_id
       FROM user_id_migration m
       WHERE t.%I = m.old_id',
      fk.schema_name,
      fk.table_name,
      fk.column_name,
      fk.column_name
    );

    GET DIAGNOSTICS row_count = ROW_COUNT;
    IF row_count > 0 THEN
      RAISE NOTICE '[UUID migration] Updated %.% (%) rows in column %',
        fk.schema_name,
        fk.table_name,
        row_count,
        fk.column_name;
    END IF;
  END LOOP;

  -- Remove legacy rows after all references are moved.
  DELETE FROM users u
  USING user_id_migration m
  WHERE u.id = m.old_id;

  -- Optional cleanup for usernames accidentally left blank.
  UPDATE users
  SET username = id
  WHERE username IS NULL OR btrim(username) = '';

  RAISE NOTICE '[UUID migration] Completed. Migrated % users to UUID IDs', legacy_count;
END $$;
