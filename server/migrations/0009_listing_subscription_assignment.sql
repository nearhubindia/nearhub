-- Migration: Add user subscription assignment to listings
-- This allows listings to be assigned to specific user subscriptions
-- for proper quota tracking and expiration management

-- Add user_subscription_id column to listings table
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "user_subscription_id" VARCHAR;

-- Add foreign key constraint to user_subscriptions
ALTER TABLE "listings" 
  ADD CONSTRAINT "listings_user_subscription_id_fk" 
  FOREIGN KEY ("user_subscription_id") 
  REFERENCES "user_subscriptions"("id")
  ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS "idx_listings_user_subscription_id" ON "listings"("user_subscription_id");

-- Add comment for documentation
COMMENT ON COLUMN "listings"."user_subscription_id" IS 'References the specific user subscription instance used to create this listing';
