-- Migration: Add listing view tracking
-- Date: 2026-02-24
-- Description: Adds viewCount column to listings table and creates listing_views table for detailed tracking

-- Add viewCount column to listings table
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Create listing_views table for detailed view tracking with IP-based deduplication
CREATE TABLE IF NOT EXISTS listing_views (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id VARCHAR NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  viewer_id VARCHAR, -- NULL for anonymous views
  ip_address VARCHAR(45), -- IPv6 support (max 45 chars)
  user_agent TEXT,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_listing_views_listing_id ON listing_views(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_viewer_id ON listing_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_ip_listing ON listing_views(ip_address, listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_viewed_at ON listing_views(viewed_at);

-- Index on listings.view_count for analytics queries
CREATE INDEX IF NOT EXISTS idx_listings_view_count ON listings(view_count DESC);
