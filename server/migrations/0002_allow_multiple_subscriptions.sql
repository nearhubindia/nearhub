-- Migration: Allow multiple subscriptions per user
-- Drop unique constraint on user_id in user_subscriptions table
-- This allows users to purchase multiple subscriptions (e.g., multiple Basic 30-Day plans)

-- Drop the unique constraint if it exists
ALTER TABLE "user_subscriptions" DROP CONSTRAINT IF EXISTS "user_subscriptions_user_id_unique";

-- Add index for performance (non-unique)
CREATE INDEX IF NOT EXISTS "idx_user_subscriptions_user_id" ON "user_subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_subscriptions_status" ON "user_subscriptions"("status");
CREATE INDEX IF NOT EXISTS "idx_user_subscriptions_expires_at" ON "user_subscriptions"("expires_at");
