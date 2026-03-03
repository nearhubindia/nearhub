-- Performance Optimization Indexes
-- Improves query performance for listings and subscriptions

-- ============================================
-- LISTINGS TABLE INDEXES
-- ============================================

-- Index for finding active listings (most common query)
CREATE INDEX IF NOT EXISTS idx_listings_active_status 
ON listings(is_active, status) 
WHERE is_active = true AND status = 'active';

-- Index for expiration queries
CREATE INDEX IF NOT EXISTS idx_listings_expires_at 
ON listings(expires_at) 
WHERE is_active = true AND status = 'active';

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_listings_category 
ON listings(category, is_active, status);

-- Index for seller listings
CREATE INDEX IF NOT EXISTS idx_listings_seller 
ON listings(seller_id, is_active, status);

-- Index for featured listings
CREATE INDEX IF NOT EXISTS idx_listings_featured 
ON listings(featured, is_active, status) 
WHERE featured = true AND is_active = true;

-- Index for location-based queries (geo-filtering)
CREATE INDEX IF NOT EXISTS idx_listings_location 
ON listings(latitude, longitude, is_active) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Composite index for common filtering pattern
CREATE INDEX IF NOT EXISTS idx_listings_active_category_created 
ON listings(is_active, category, created_at DESC);

-- Index for price range queries
CREATE INDEX IF NOT EXISTS idx_listings_price 
ON listings(price, is_active, status);

-- ============================================
-- USER SUBSCRIPTIONS TABLE INDEXES
-- ============================================

-- Index for finding user subscriptions (most common)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status 
ON user_subscriptions(user_id, status);

-- Index for expiration queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at 
ON user_subscriptions(expires_at, status) 
WHERE status = 'active';

-- Index for active subscriptions lookup
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active 
ON user_subscriptions(user_id, status, expires_at) 
WHERE status = 'active';

-- Index for subscription tier lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier 
ON user_subscriptions(subscription_tier_id, status);

-- Index for payment tracking
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_payment 
ON user_subscriptions(payment_id) 
WHERE payment_id IS NOT NULL;

-- ============================================
-- SUBSCRIPTION TIERS TABLE INDEXES
-- ============================================

-- Index for active tiers
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_active 
ON subscription_tiers(is_active, price);

-- Index for tier type filtering
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_type 
ON subscription_tiers(type, is_active);

-- ============================================
-- ANALYTICS & REPORTING INDEXES
-- ============================================

-- Index for created_at queries (reports, analytics)
CREATE INDEX IF NOT EXISTS idx_listings_created_at 
ON listings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_subscribed_at 
ON user_subscriptions(subscribed_at DESC);

-- Index for view count (popular listings)
CREATE INDEX IF NOT EXISTS idx_listings_view_count 
ON listings(view_count DESC, is_active) 
WHERE is_active = true;

-- ============================================
-- PERFORMANCE STATISTICS
-- ============================================

-- Analyze tables to update statistics
ANALYZE listings;
ANALYZE user_subscriptions;
ANALYZE subscription_tiers;

-- Show index information
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('listings', 'user_subscriptions', 'subscription_tiers')
ORDER BY tablename, indexname;
