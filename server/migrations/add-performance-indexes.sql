-- NearHub Database Performance Indexes
-- Generated: March 2, 2026
-- Purpose: Add missing database indexes for better query performance
--
-- Expected Impact: 10-100x faster queries on large datasets
-- Estimated Time: 5-10 minutes (depending on data volume)
--
-- IMPORTANT: Run these during low-traffic period
-- These create indexes concurrently to avoid locking tables

-- ============================================================================
-- Listings Table Indexes
-- ============================================================================

-- Single column indexes for common filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_seller_id 
  ON listings(seller_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_category 
  ON listings(category);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_status 
  ON listings(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_is_active 
  ON listings(is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_created_at_desc 
  ON listings(created_at DESC);

-- Partial index for active listings (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_active_only 
  ON listings(created_at DESC) 
  WHERE is_active = true AND status = 'active';

-- Index for expiration checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_expires_at 
  ON listings(expires_at) 
  WHERE expires_at IS NOT NULL AND is_active = true;

-- Compound index for category browsing (active listings in category, sorted by date)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_active_category_created 
  ON listings(is_active, category, created_at DESC);

-- Index for seller's listings page
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_seller_created 
  ON listings(seller_id, created_at DESC);

-- Spatial index for location-based queries (if using PostGIS)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_location_gist 
--   ON listings USING GIST(location);

-- Index for pincode-based searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_pincode 
  ON listings(pincode) 
  WHERE pincode IS NOT NULL;

-- Partial index for featured listings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_featured 
  ON listings(created_at DESC) 
  WHERE featured = true AND is_active = true;

-- Index for price range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_price 
  ON listings(price);

-- ============================================================================
-- Listing Analytics Indexes
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listing_views_listing_id 
  ON listing_views(listing_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listing_views_created_at 
  ON listing_views(created_at DESC);

-- Compound index for analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listing_views_listing_created 
  ON listing_views(listing_id, created_at DESC);

-- Partial index for recent views (last 30 days)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listing_views_recent 
  ON listing_views(listing_id, created_at DESC) 
  WHERE created_at > NOW() - INTERVAL '30 days';

-- ============================================================================
-- Subscriptions & Tiers
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_seller_id 
  ON subscriptions(seller_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_tier_id 
  ON subscriptions(subscription_tier_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_expires_at 
  ON subscriptions(expires_at);

-- Partial index for active subscriptions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_active 
  ON subscriptions(seller_id, expires_at DESC) 
  WHERE is_active = true AND expires_at > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscription_tiers_price 
  ON subscription_tiers(price);

-- ============================================================================
-- User Subscriptions
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_user_id 
  ON user_subscriptions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_tier_id 
  ON user_subscriptions(tier_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_status 
  ON user_subscriptions(status, expires_at DESC);

-- Compound index for checking active user subscriptions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_active 
  ON user_subscriptions(user_id, status, expires_at DESC) 
  WHERE status = 'active';

-- ============================================================================
-- Coupons
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupons_code 
  ON coupons(code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupons_valid_from 
  ON coupons(valid_from);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupons_valid_until 
  ON coupons(valid_until);

-- Partial index for active coupons
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupons_active 
  ON coupons(code, discount_percent) 
  WHERE is_active = true 
    AND valid_from <= NOW() 
    AND valid_until >= NOW();

-- Coupon usage tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupon_usage_coupon_id 
  ON coupon_usage(coupon_id);

-- Note: idx_coupon_usage_user_id already exists from migration

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupon_usage_listing_id 
  ON coupon_usage(listing_id);

-- ============================================================================
-- Push Notifications
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_tokens_user_id 
  ON push_tokens(user_id);

-- Partial index for active tokens only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_tokens_active 
  ON push_tokens(user_id, expo_token) 
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_tokens_platform 
  ON push_tokens(platform);

-- ============================================================================
-- In-App Notifications
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id 
  ON notifications(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at 
  ON notifications(created_at DESC);

-- Compound index for user's notifications feed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created 
  ON notifications(user_id, created_at DESC);

-- Partial index for unread notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread 
  ON notifications(user_id, created_at DESC) 
  WHERE is_read = false;

-- Index for notification type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type 
  ON notifications(notification_type, created_at DESC);

-- ============================================================================
-- Messages/Chat
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_chat_id 
  ON messages(chat_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender_id 
  ON messages(sender_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_created_at 
  ON messages(created_at DESC);

-- Compound index for chat message history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_chat_created 
  ON messages(chat_id, created_at DESC);

-- Partial index for unread messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_unread 
  ON messages(chat_id, is_read, created_at DESC) 
  WHERE is_read = false;

-- ============================================================================
-- Users
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_phone 
  ON users(phone);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
  ON users(email) 
  WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at 
  ON users(created_at DESC);

-- ============================================================================
-- Invoices
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_user_id 
  ON invoices(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_subscription_id 
  ON invoices(subscription_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_created_at 
  ON invoices(created_at DESC);

-- Compound index for user's invoice history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_user_created 
  ON invoices(user_id, created_at DESC);

-- ============================================================================
-- Banners
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_banners_screen 
  ON banners(screen);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_banners_position 
  ON banners(position);

-- Partial index for active banners
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_banners_active 
  ON banners(screen, position) 
  WHERE is_active = true;

-- ============================================================================
-- Verification & Statistics
-- ============================================================================

-- Check index sizes
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Identify missing indexes (run after some production usage)
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100  -- High cardinality columns
  AND correlation < 0.1  -- Low correlation (good candidates for indexing)
ORDER BY n_distinct DESC;

-- ============================================================================
-- Maintenance
-- ============================================================================

-- Update table statistics (run periodically)
-- ANALYZE listings;
-- ANALYZE subscriptions;
-- ANALYZE notifications;
-- ANALYZE messages;

-- Reindex if needed (rarely, only if index bloat detected)
-- REINDEX TABLE CONCURRENTLY listings;

-- ============================================================================
-- Notes
-- ============================================================================

/*
1. CONCURRENTLY keyword prevents table locking during index creation
2. Partial indexes (WHERE clause) are smaller and faster for specific queries
3. Compound indexes should match common query patterns (WHERE + ORDER BY)
4. Monitor index usage with:
   SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan DESC;
5. Remove unused indexes:
   SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;
*/
