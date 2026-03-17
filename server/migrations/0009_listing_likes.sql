-- Listing likes/saves table for live like counts on listing cards.
-- Safe to run once in normal migration flow.

CREATE TABLE IF NOT EXISTS listing_likes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id varchar NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_likes_listing_user_unique
ON listing_likes (listing_id, user_id);

CREATE INDEX IF NOT EXISTS idx_listing_likes_listing_id_created_at
ON listing_likes (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_likes_user_id_created_at
ON listing_likes (user_id, created_at DESC);
