-- Schema hardening: integrity checks + performance indexes.
-- Safe forward migration on top of 0000_lucky_sentry baseline.

-- Ensure legacy nullable users.created_at is backfilled before enforcing NOT NULL.
UPDATE users
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

ALTER TABLE users
ALTER COLUMN created_at SET NOT NULL;

-- Constrain common status columns to valid finite states.
ALTER TABLE listings
ADD CONSTRAINT listings_status_chk
CHECK (status IN ('active', 'sold', 'pending', 'expired'))
NOT VALID;

ALTER TABLE user_subscriptions
ADD CONSTRAINT user_subscriptions_status_chk
CHECK (status IN ('active', 'expired', 'pending', 'cancelled'))
NOT VALID;

ALTER TABLE notification_logs
ADD CONSTRAINT notification_logs_status_chk
CHECK (status IN ('sent', 'delivered', 'failed'))
NOT VALID;

-- Coupon counters should never go negative or exceed configured maximum.
ALTER TABLE coupons
ADD CONSTRAINT coupons_usage_count_range_chk
CHECK (usage_count >= 0 AND usage_count <= max_usage_count)
NOT VALID;

-- Basic anti-abuse bound for chat payloads.
ALTER TABLE chat_messages
ADD CONSTRAINT chat_messages_text_len_chk
CHECK (char_length(text) <= 2000)
NOT VALID;

-- Validate new constraints against existing data.
ALTER TABLE listings VALIDATE CONSTRAINT listings_status_chk;
ALTER TABLE user_subscriptions VALIDATE CONSTRAINT user_subscriptions_status_chk;
ALTER TABLE notification_logs VALIDATE CONSTRAINT notification_logs_status_chk;
ALTER TABLE coupons VALIDATE CONSTRAINT coupons_usage_count_range_chk;
ALTER TABLE chat_messages VALIDATE CONSTRAINT chat_messages_text_len_chk;

-- Search and feed performance indexes.
CREATE INDEX IF NOT EXISTS idx_listings_search_gin
ON listings
USING GIN (
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(location, '')
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created_desc
ON chat_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_expires
ON in_app_notifications (user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_listings_geo
ON listings (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_feed
ON listings (is_active, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_user_device_unique
ON push_tokens (user_id, device_id)
WHERE device_id IS NOT NULL AND device_id <> '';
