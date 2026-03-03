-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_percentage INTEGER NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  max_usage_count INTEGER NOT NULL CHECK (max_usage_count > 0),
  usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create coupon_usage table
CREATE TABLE IF NOT EXISTS coupon_usage (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id VARCHAR NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  listing_id VARCHAR NOT NULL,
  subscription_id VARCHAR NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_expires_at ON coupons(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupons_created_at ON coupons(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_listing_id ON coupon_usage(listing_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_subscription_id ON coupon_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_used_at ON coupon_usage(used_at DESC);

-- Verify tables
SELECT 'Coupons table' as table_name, COUNT(*) as columns FROM information_schema.columns WHERE table_name = 'coupons'
UNION ALL
SELECT 'Coupon Usage table', COUNT(*) FROM information_schema.columns WHERE table_name = 'coupon_usage';
