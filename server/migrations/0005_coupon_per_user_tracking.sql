-- Migration: Add per-user coupon usage tracking
-- Date: 2026-02-24
-- Description: Adds user_id column to coupon_usage table to restrict coupons to one use per user

-- Add user_id column to coupon_usage table
ALTER TABLE coupon_usage 
ADD COLUMN IF NOT EXISTS user_id VARCHAR NOT NULL DEFAULT 'unknown';

-- Create index for efficient user+coupon lookups
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_coupon ON coupon_usage(user_id, coupon_id);

-- Create index on user_id for analytics queries
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON coupon_usage(user_id);

-- Note: For existing records, user_id will be 'unknown'
-- Future coupon usage will properly track the actual user_id
