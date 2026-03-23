-- Add FK support indexes and hot-path query indexes.
-- Safe to run multiple times.

CREATE INDEX IF NOT EXISTS idx_listings_seller_id_created_at
ON listings (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_status_active_expires
ON listings (status, is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_created_at
ON chat_messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id
ON coupon_usage (coupon_id);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id
ON coupon_usage (user_id);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id
ON invoices (customer_id);

CREATE INDEX IF NOT EXISTS idx_listing_views_listing_id_viewed_at
ON listing_views (listing_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_views_viewer_id_viewed_at
ON listing_views (viewer_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id_sent_at
ON notification_logs (user_id, sent_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'listing_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_listing_id
    ON subscriptions (listing_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'subscription_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_transactions_subscription_id
    ON transactions (subscription_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id_status_subscribed
ON user_subscriptions (user_id, status, subscribed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_coupon_id
ON user_subscriptions (coupon_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_invoice_id
ON user_subscriptions (invoice_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier_id
ON user_subscriptions (subscription_tier_id);

CREATE INDEX IF NOT EXISTS idx_users_email
ON users (email)
WHERE email IS NOT NULL AND btrim(email) <> '';
