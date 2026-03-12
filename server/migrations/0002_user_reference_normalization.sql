-- Normalize user references to users.id and enforce FK integrity.
-- This migration is designed to be safe with mixed historical identifiers.

-- 1) Canonical trim for user IDs in users table.
UPDATE users
SET id = btrim(id)
WHERE id <> btrim(id);

UPDATE users
SET username = btrim(username)
WHERE username <> btrim(username);

-- 2) Map legacy references that used users.mobile/users.username into users.id.
UPDATE listings l
SET seller_id = u.id
FROM users u
WHERE l.seller_id <> u.id
  AND (l.seller_id = u.mobile OR l.seller_id = u.username);

UPDATE chat_conversations c
SET buyer_id = u.id
FROM users u
WHERE c.buyer_id <> u.id
  AND (c.buyer_id = u.mobile OR c.buyer_id = u.username);

UPDATE chat_conversations c
SET seller_id = u.id
FROM users u
WHERE c.seller_id <> u.id
  AND (c.seller_id = u.mobile OR c.seller_id = u.username);

UPDATE chat_messages m
SET sender_id = u.id
FROM users u
WHERE m.sender_id <> u.id
  AND (m.sender_id = u.mobile OR m.sender_id = u.username);

UPDATE chat_messages m
SET recipient_id = u.id
FROM users u
WHERE m.recipient_id <> u.id
  AND (m.recipient_id = u.mobile OR m.recipient_id = u.username);

UPDATE coupon_usage cu
SET user_id = u.id
FROM users u
WHERE cu.user_id <> u.id
  AND (cu.user_id = u.mobile OR cu.user_id = u.username);

UPDATE push_tokens pt
SET user_id = u.id
FROM users u
WHERE pt.user_id <> u.id
  AND (pt.user_id = u.mobile OR pt.user_id = u.username);

UPDATE notification_logs nl
SET user_id = u.id
FROM users u
WHERE nl.user_id IS NOT NULL
  AND nl.user_id <> u.id
  AND (nl.user_id = u.mobile OR nl.user_id = u.username);

UPDATE in_app_notifications n
SET user_id = u.id
FROM users u
WHERE n.user_id IS NOT NULL
  AND n.user_id <> u.id
  AND (n.user_id = u.mobile OR n.user_id = u.username);

UPDATE user_activity ua
SET user_id = u.id
FROM users u
WHERE ua.user_id <> u.id
  AND (ua.user_id = u.mobile OR ua.user_id = u.username);

UPDATE user_starter_credits usc
SET user_id = u.id
FROM users u
WHERE usc.user_id <> u.id
  AND (usc.user_id = u.mobile OR usc.user_id = u.username);

UPDATE user_subscriptions us
SET user_id = u.id
FROM users u
WHERE us.user_id <> u.id
  AND (us.user_id = u.mobile OR us.user_id = u.username);

UPDATE invoices i
SET customer_id = u.id
FROM users u
WHERE i.customer_id IS NOT NULL
  AND i.customer_id <> u.id
  AND (i.customer_id = u.mobile OR i.customer_id = u.username);

UPDATE user_deletion_reviews udr
SET user_id = u.id
FROM users u
WHERE udr.user_id <> u.id
  AND (udr.user_id = u.mobile OR udr.user_id = u.username);

UPDATE listing_views lv
SET viewer_id = u.id
FROM users u
WHERE lv.viewer_id IS NOT NULL
  AND lv.viewer_id <> u.id
  AND (lv.viewer_id = u.mobile OR lv.viewer_id = u.username);

-- 3) Ensure every referenced user ID exists in users.
WITH referenced_user_ids AS (
  SELECT DISTINCT btrim(seller_id) AS user_id FROM listings WHERE btrim(seller_id) <> ''
  UNION
  SELECT DISTINCT btrim(buyer_id) FROM chat_conversations WHERE btrim(buyer_id) <> ''
  UNION
  SELECT DISTINCT btrim(seller_id) FROM chat_conversations WHERE btrim(seller_id) <> ''
  UNION
  SELECT DISTINCT btrim(sender_id) FROM chat_messages WHERE btrim(sender_id) <> ''
  UNION
  SELECT DISTINCT btrim(recipient_id) FROM chat_messages WHERE btrim(recipient_id) <> ''
  UNION
  SELECT DISTINCT btrim(user_id) FROM coupon_usage WHERE btrim(user_id) <> ''
  UNION
  SELECT DISTINCT btrim(user_id) FROM push_tokens WHERE btrim(user_id) <> ''
  UNION
  SELECT DISTINCT btrim(user_id) FROM notification_logs WHERE user_id IS NOT NULL AND btrim(user_id) <> ''
  UNION
  SELECT DISTINCT btrim(user_id) FROM in_app_notifications WHERE user_id IS NOT NULL AND btrim(user_id) <> ''
  UNION
  SELECT DISTINCT btrim(user_id) FROM user_activity WHERE btrim(user_id) <> ''
  UNION
  SELECT DISTINCT btrim(user_id) FROM user_starter_credits WHERE btrim(user_id) <> ''
  UNION
  SELECT DISTINCT btrim(user_id) FROM user_subscriptions WHERE btrim(user_id) <> ''
  UNION
  SELECT DISTINCT btrim(customer_id) FROM invoices WHERE customer_id IS NOT NULL AND btrim(customer_id) <> ''
  UNION
  SELECT DISTINCT btrim(user_id) FROM user_deletion_reviews WHERE btrim(user_id) <> ''
  UNION
  SELECT DISTINCT btrim(viewer_id) FROM listing_views WHERE viewer_id IS NOT NULL AND btrim(viewer_id) <> ''
),
missing AS (
  SELECT r.user_id
  FROM referenced_user_ids r
  LEFT JOIN users u ON u.id = r.user_id
  WHERE u.id IS NULL
)
INSERT INTO users (id, username, password, mobile, location, created_at)
SELECT
  m.user_id,
  m.user_id,
  'otp-auth',
  CASE WHEN m.user_id ~ '^[0-9]{10}$' THEN m.user_id ELSE NULL END,
  NULL,
  CURRENT_TIMESTAMP
FROM missing m;

-- 4) Add FK constraints for normalized user references.
ALTER TABLE listings
ADD CONSTRAINT listings_seller_id_users_id_fk
FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;

ALTER TABLE chat_conversations
ADD CONSTRAINT chat_conversations_buyer_id_users_id_fk
FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;

ALTER TABLE chat_conversations
ADD CONSTRAINT chat_conversations_seller_id_users_id_fk
FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;

ALTER TABLE chat_messages
ADD CONSTRAINT chat_messages_sender_id_users_id_fk
FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;

ALTER TABLE chat_messages
ADD CONSTRAINT chat_messages_recipient_id_users_id_fk
FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;

ALTER TABLE coupon_usage
ADD CONSTRAINT coupon_usage_user_id_users_id_fk
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;

ALTER TABLE push_tokens
ADD CONSTRAINT push_tokens_user_id_users_id_fk
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;

ALTER TABLE notification_logs
ADD CONSTRAINT notification_logs_user_id_users_id_fk
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
NOT VALID;

ALTER TABLE in_app_notifications
ADD CONSTRAINT in_app_notifications_user_id_users_id_fk
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
NOT VALID;

ALTER TABLE user_activity
ADD CONSTRAINT user_activity_user_id_users_id_fk
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;

ALTER TABLE user_starter_credits
ADD CONSTRAINT user_starter_credits_user_id_users_id_fk
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;

ALTER TABLE user_subscriptions
ADD CONSTRAINT user_subscriptions_user_id_users_id_fk
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;

ALTER TABLE invoices
ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE invoices
ADD CONSTRAINT invoices_customer_id_users_id_fk
FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL
NOT VALID;

ALTER TABLE user_deletion_reviews
ADD CONSTRAINT user_deletion_reviews_user_id_users_id_fk
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;

ALTER TABLE listing_views
ADD CONSTRAINT listing_views_viewer_id_users_id_fk
FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE SET NULL
NOT VALID;

-- 5) Validate after backfill.
ALTER TABLE listings VALIDATE CONSTRAINT listings_seller_id_users_id_fk;
ALTER TABLE chat_conversations VALIDATE CONSTRAINT chat_conversations_buyer_id_users_id_fk;
ALTER TABLE chat_conversations VALIDATE CONSTRAINT chat_conversations_seller_id_users_id_fk;
ALTER TABLE chat_messages VALIDATE CONSTRAINT chat_messages_sender_id_users_id_fk;
ALTER TABLE chat_messages VALIDATE CONSTRAINT chat_messages_recipient_id_users_id_fk;
ALTER TABLE coupon_usage VALIDATE CONSTRAINT coupon_usage_user_id_users_id_fk;
ALTER TABLE push_tokens VALIDATE CONSTRAINT push_tokens_user_id_users_id_fk;
ALTER TABLE notification_logs VALIDATE CONSTRAINT notification_logs_user_id_users_id_fk;
ALTER TABLE in_app_notifications VALIDATE CONSTRAINT in_app_notifications_user_id_users_id_fk;
ALTER TABLE user_activity VALIDATE CONSTRAINT user_activity_user_id_users_id_fk;
ALTER TABLE user_starter_credits VALIDATE CONSTRAINT user_starter_credits_user_id_users_id_fk;
ALTER TABLE user_subscriptions VALIDATE CONSTRAINT user_subscriptions_user_id_users_id_fk;
ALTER TABLE invoices VALIDATE CONSTRAINT invoices_customer_id_users_id_fk;
ALTER TABLE user_deletion_reviews VALIDATE CONSTRAINT user_deletion_reviews_user_id_users_id_fk;
ALTER TABLE listing_views VALIDATE CONSTRAINT listing_views_viewer_id_users_id_fk;
