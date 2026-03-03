-- Migration: Add plan restrictions to coupons
-- Date: 2026-02-24
-- Description: Adds applicable_tiers column to coupons table to restrict coupons to specific subscription plans

-- Add applicable_tiers column to coupons table
ALTER TABLE coupons 
ADD COLUMN IF NOT EXISTS applicable_tiers TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN coupons.applicable_tiers IS 'JSON array of subscription_tier IDs this coupon can be applied to. NULL means applicable to all plans.';

-- Example values:
-- NULL - Coupon applies to all subscription plans
-- '["tier_id_1", "tier_id_2"]' - Coupon only applies to specific tiers
