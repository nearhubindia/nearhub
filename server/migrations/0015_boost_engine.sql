ALTER TABLE subscription_tiers
ADD COLUMN IF NOT EXISTS boost_credits integer NOT NULL DEFAULT 0;

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS boosts_remaining integer NOT NULL DEFAULT 0;

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS boosted_until timestamp;

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS boost_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_listings_boosted_until
  ON listings (boosted_until)
  WHERE boosted_until IS NOT NULL;
