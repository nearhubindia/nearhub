-- Add videos column to listings table for supporting multiple videos per listing
ALTER TABLE "listings" ADD COLUMN "videos" text;

-- Create index for better query performance
CREATE INDEX "listings_videos_idx" ON "listings"("videos");
