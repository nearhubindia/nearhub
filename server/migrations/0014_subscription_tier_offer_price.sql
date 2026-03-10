ALTER TABLE subscription_tiers
ADD COLUMN IF NOT EXISTS offer_price numeric(10, 2);
