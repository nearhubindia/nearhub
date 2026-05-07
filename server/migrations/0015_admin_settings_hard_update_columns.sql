-- Add hard-update fields to admin_settings for persistent app version enforcement.
ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS force_update_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS min_supported_version varchar(32) NOT NULL DEFAULT '1.0.0',
ADD COLUMN IF NOT EXISTS min_supported_android_build_number integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS min_supported_ios_build_number integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS force_update_message text NOT NULL DEFAULT 'A new app version is required to continue. Please update now.',
ADD COLUMN IF NOT EXISTS play_store_url text NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.synvide.nearhub',
ADD COLUMN IF NOT EXISTS app_store_url text NOT NULL DEFAULT '';
