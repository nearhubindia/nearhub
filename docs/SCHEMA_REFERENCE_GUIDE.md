# Schema Reference Guide

This guide describes the complete PostgreSQL schema currently defined by:
- `server/migrations/0000_lucky_sentry.sql`

## Database Summary
- Total tables: 21
- Primary domains: users, listings, subscriptions, coupons, chat, notifications, admin

## Table Catalog

### `admin_settings`
- PK: `id`
- Purpose: global runtime settings and pricing controls.
- Key columns:
  - Pricing: `image_fee_per_day`, `video_fee_per_day`, duration price columns
  - Free/starter: `free_listing_days`, `starter_credits_enabled`, `starter_listings_count`, `starter_boosts_count`
  - Discounts/behavior: `discount_enabled`, `discount_percentage`, `reactivation_pricing_multiplier`
  - Lifecycle/search: `geo_radius_km`, `inactive_user_review_days`
  - Timestamps: `created_at`, `updated_at`

### `app_screen_banners`
- PK: `id`
- Purpose: app CMS banners.
- Key columns: `title`, `screen`, `image_url`, `sort_order`, `is_active`, `created_by`, `created_at`, `updated_at`

### `users`
- PK: `id`
- Unique constraints:
  - `users_username_unique` on `username`
  - Partial unique index `idx_users_mobile_unique_nonempty` on `mobile` where non-empty
- Check constraints:
  - `users_mobile_format_chk`: mobile must be null/empty or 10 digits
- Key columns: `username`, `password`, `mobile`, `location`, `created_at`

### `user_activity`
- PK: `user_id`
- Purpose: lifecycle activity tracking.
- Key columns: `first_seen_at`, `last_seen_at`, `last_seen_ip`, `last_seen_user_agent`, `updated_at`
- Indexes: `idx_user_activity_last_seen_at`

### `user_deletion_reviews`
- PK: `id`
- Purpose: admin review queue for inactive-user cleanup.
- Key columns: `user_id`, `last_seen_at`, `status`, `reviewed_by`, `processed_at`, `notes`, `last_error`, `created_at`, `updated_at`
- Indexes: `idx_user_deletion_reviews_status`

### `user_starter_credits`
- PK: `id`
- Unique: `user_starter_credits_user_id_unique` on `user_id`
- Purpose: one-time starter credits per user.
- Key columns: `listings_total`, `listings_used`, `boosts_total`, `boosts_used`, `is_active`, `granted_at`, `granted_by`, `updated_at`

### `subscription_tiers`
- PK: `id`
- Purpose: available subscription plans.
- Key columns: `name`, `type`, `monthly_price`, `annual_price`, `price`, `offer_price`, `duration_days`, `features`, `max_listings`, `featured_listings_per_month`, `boost_credits`, `highlight`, `is_active`, `created_at`, `updated_at`

### `user_subscriptions`
- PK: `id`
- FKs:
  - `subscription_tier_id -> subscription_tiers.id`
  - `invoice_id -> invoices.id`
  - `coupon_id -> coupons.id`
- Purpose: active/expired user entitlements.
- Key columns: `user_id`, `payment_id`, `order_id`, `expires_at`, `auto_renew`, `status`, `boosts_remaining`, `subscribed_at`, `updated_at`
- Indexes: `idx_user_subscriptions_user_status_expires`

### `invoices`
- PK: `id`
- Unique: `invoices_invoice_number_unique` on `invoice_number`
- Purpose: invoice ledger and payment references.
- Key columns: customer details, `subscription_id`, `order_id`, `payment_id`, tax columns (`sgst`, `cgst`, `igst`), `total_amount`, `invoice_data`, `status`, `invoice_date`, `due_date`, `created_at`, `updated_at`

### `coupons`
- PK: `id`
- Unique: `coupons_code_unique` on `code`
- Purpose: discount and free-listing coupon definitions.
- Key columns: `discount_percentage`, `applicable_tiers`, `free_listings`, `free_listing_duration_days`, `max_usage_count`, `usage_count`, `is_active`, `expires_at`, `created_by`, `created_at`, `updated_at`

### `coupon_usage`
- PK: `id`
- FK: `coupon_id -> coupons.id` (ON DELETE CASCADE)
- Purpose: coupon redemption audit.
- Key columns: `listing_id`, `subscription_id`, `user_id`, `discount_amount`, `used_at`

### `listings`
- PK: `id`
- FKs:
  - `subscription_tier_id -> subscription_tiers.id`
  - `user_subscription_id -> user_subscriptions.id`
  - `coupon_id -> coupons.id`
- Purpose: marketplace listings.
- Key columns:
  - Identity: `seller_id`, `title`, `category`, `condition`
  - Pricing: `price`, `offer_price`, `price_unit`
  - Media: `images`, `videos`
  - Location: `location`, `pincode`, `latitude`, `longitude`
  - Status/visibility: `status`, `is_active`, `is_paid`, `featured`, `sponsored`
  - Boost/expiry: `boosted_until`, `boost_count`, `duration_days`, `expires_at`
  - Analytics: `view_count`
  - Timestamps: `created_at`, `updated_at`
- Indexes:
  - `idx_listings_active_category_created`
  - `idx_listings_active_only` (partial)
  - `idx_listings_seller_created`
  - `idx_listings_expires_at_active` (partial)

### `listing_views`
- PK: `id`
- FK: `listing_id -> listings.id` (ON DELETE CASCADE)
- Purpose: view telemetry.
- Key columns: `viewer_id`, `ip_address`, `user_agent`, `viewed_at`

### `chat_conversations`
- PK: `id`
- FK: `listing_id -> listings.id` (ON DELETE CASCADE)
- Unique index: `uq_chat_conversation` on (`listing_id`, `buyer_id`, `seller_id`)
- Purpose: one conversation per buyer/seller/listing tuple.
- Key columns: `buyer_id`, `seller_id`, `last_message`, `last_message_at`, `created_at`, `updated_at`
- Indexes:
  - `idx_chat_conversations_buyer_updated`
  - `idx_chat_conversations_seller_updated`

### `chat_messages`
- PK: `id`
- FK: `conversation_id -> chat_conversations.id` (ON DELETE CASCADE)
- Purpose: conversation messages.
- Key columns: `sender_id`, `recipient_id`, `text`, `created_at`
- Indexes:
  - `idx_chat_messages_conversation_created`
  - `idx_chat_messages_recipient_created`

### `location_index`
- PK: `pincode`
- Purpose: geo lookup/search normalization.
- Key columns: `location_name`, `city`, `state`, `district`, `latitude`, `longitude`, `region`, `search_text`, `created_at`, `updated_at`

### `push_tokens`
- PK: `id`
- Unique: `push_tokens_token_unique` on `token`
- Purpose: push target registry.
- Key columns: `user_id`, `platform`, `device_id`, `user_type`, `is_active`, `created_at`, `updated_at`, `last_used_at`

### `notification_logs`
- PK: `id`
- Purpose: push delivery audit.
- Key columns: `user_id`, `user_type`, `title`, `body`, `data`, `notification_type`, `status`, `sent_count`, `error_message`, `sent_by`, `sent_at`

### `in_app_notifications`
- PK: `id`
- Purpose: in-app notification center.
- Key columns: `user_id`, `user_type`, `title`, `message`, `type`, `action_label`, `action_url`, `category`, `reference_id`, `is_read`, `read_at`, `priority`, `expires_at`, `created_by`, `created_at`

### `contact_submissions`
- PK: `id`
- Purpose: web/app support/contact intake.
- Key columns: `name`, `email`, `phone`, `subject`, `message`, `source`, `contacted`, `admin_comments`, `contacted_at`, `ip_address`, `user_agent`, `created_at`

### `contact_submission_comments`
- PK: `id`
- FK: `submission_id -> contact_submissions.id` (ON DELETE CASCADE)
- Purpose: multi-comment admin thread for each submission.
- Key columns: `comment`, `created_by`, `created_at`, `updated_at`

## Foreign Key Matrix
- `chat_conversations.listing_id -> listings.id` (cascade delete)
- `chat_messages.conversation_id -> chat_conversations.id` (cascade delete)
- `contact_submission_comments.submission_id -> contact_submissions.id` (cascade delete)
- `coupon_usage.coupon_id -> coupons.id` (cascade delete)
- `listing_views.listing_id -> listings.id` (cascade delete)
- `listings.subscription_tier_id -> subscription_tiers.id`
- `listings.user_subscription_id -> user_subscriptions.id`
- `listings.coupon_id -> coupons.id`
- `user_subscriptions.subscription_tier_id -> subscription_tiers.id`
- `user_subscriptions.invoice_id -> invoices.id`
- `user_subscriptions.coupon_id -> coupons.id`
- `invoices.customer_id -> users.id` (set null on user delete)

## High-Value Constraints
- `users_mobile_format_chk`
- `users_username_unique`
- `idx_users_mobile_unique_nonempty` (partial unique)
- `uq_chat_conversation`
- `coupons_code_unique`
- `invoices_invoice_number_unique`
- `push_tokens_token_unique`
- `user_starter_credits_user_id_unique`

## Migration Notes
- Current baseline: `server/migrations/0000_lucky_sentry.sql`
- Hardening migration: `server/migrations/0001_schema_hardening.sql`
- User reference normalization + FK migration: `server/migrations/0002_user_reference_normalization.sql`
- New schema changes should be generated via `npm run db:create` and applied with `npm run db:migrate`.
- Do not reintroduce manual migration runners.

## March 2026 Hardening Additions
- Status check constraints:
  - `listings_status_chk`
  - `user_subscriptions_status_chk`
  - `notification_logs_status_chk`
- Counter safety/check constraints:
  - `coupons_usage_count_range_chk`
- Anti-abuse constraint:
  - `chat_messages_text_len_chk` (`<= 2000` chars)
- Additional indexes:
  - `idx_listings_search_gin` (full-text search on title/category/location)
  - `idx_chat_messages_conversation_created_desc`
  - `idx_in_app_notifications_user_expires`
  - `idx_listings_geo`
  - `idx_listings_feed`
  - `idx_push_tokens_user_device_unique`
- `users.created_at` hardened to `NOT NULL` (after backfill)

## User FK Normalization (Implemented)
The following references are normalized to `users.id` and constrained via FKs:
- `listings.seller_id`
- `chat_conversations.buyer_id`
- `chat_conversations.seller_id`
- `chat_messages.sender_id`
- `chat_messages.recipient_id`
- `coupon_usage.user_id`
- `push_tokens.user_id`
- `notification_logs.user_id` (`ON DELETE SET NULL`)
- `in_app_notifications.user_id` (`ON DELETE SET NULL`)
- `user_activity.user_id`
- `user_starter_credits.user_id`
- `user_subscriptions.user_id`
- `invoices.customer_id` (`ON DELETE SET NULL`)
- `user_deletion_reviews.user_id`
- `listing_views.viewer_id` (`ON DELETE SET NULL`)

Intentionally not FK-bound to users:
- admin metadata like `created_by` fields (can represent non-user/system actors)
