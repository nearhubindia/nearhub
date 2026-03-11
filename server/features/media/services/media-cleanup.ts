/**
 * Media Cleanup Service
 * Automatically deletes videos and images from expired listings
 * that haven't been renewed within the configured timeframe (default: 60 days)
 */

import * as fs from 'fs';
import * as path from 'path';
import { deleteMediaByKeys } from './cloudflare-media';

// Types for cleanup operations
export interface MediaCleanupResult {
  listingId: string;
  mediaType: 'image' | 'video';
  deletedFiles: string[];
  deletedCount: number;
  errors: string[];
}

export interface CleanupSummary {
  totalListingsProcessed: number;
  totalFilesDeleted: number;
  totalErrors: number;
  results: MediaCleanupResult[];
}

/**
 * Delete video file from upload directory
 */
export async function deleteVideoFile(videoUrl: string): Promise<boolean> {
  try {
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      const result = await deleteMediaByKeys([videoUrl]);
      return result.deleted.length > 0;
    }

    // Extract file path from URL (e.g., /videos/abc123_video.mp4 -> abc123_video.mp4)
    const fileName = videoUrl.replace(/^\/videos\//, '');
    const uploadDir = process.env.UPLOAD_DIR || '/tmp/video-uploads';
    const filePath = path.join(uploadDir, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[MediaCleanup] Deleted video: ${filePath}`);
      return true;
    } else {
      console.log(`[MediaCleanup] Video file not found: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`[MediaCleanup] Error deleting video ${videoUrl}:`, error);
    return false;
  }
}

/**
 * Delete image file from storage
 * This is a placeholder - update based on your image storage implementation
 */
export async function deleteImageFile(imageUrl: string): Promise<boolean> {
  try {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const result = await deleteMediaByKeys([imageUrl]);
      return result.deleted.length > 0;
    }

    // If using local file storage
    if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('file://')) {
      const fileName = imageUrl.replace(/^(\/uploads\/|file:\/\/)/, '');
      const uploadDir = process.env.IMAGE_UPLOAD_DIR || '/tmp/image-uploads';
      const filePath = path.join(uploadDir, fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[MediaCleanup] Deleted image: ${filePath}`);
        return true;
      }
    }

    // If using external CDN/storage (e.g., Cloudinary, S3)
    // Add your deletion logic here
    console.log(`[MediaCleanup] Image is external, skipping: ${imageUrl}`);
    return false;
  } catch (error) {
    console.error(`[MediaCleanup] Error deleting image ${imageUrl}:`, error);
    return false;
  }
}

/**
 * Clean up media for a single listing
 */
export async function cleanupListingMedia(
  listingId: string,
  listingType: 'image' | 'video',
  images: string[],
  videoUrl?: string | null
): Promise<MediaCleanupResult> {
  const result: MediaCleanupResult = {
    listingId,
    mediaType: listingType,
    deletedFiles: [],
    deletedCount: 0,
    errors: [],
  };

  try {
    if (listingType === 'video' && videoUrl) {
      const deleted = await deleteVideoFile(videoUrl);
      if (deleted) {
        result.deletedFiles.push(videoUrl);
        result.deletedCount++;
      } else {
        result.errors.push(`Failed to delete video: ${videoUrl}`);
      }
    }

    if (listingType === 'image' && images && images.length > 0) {
      for (const imageUrl of images) {
        const deleted = await deleteImageFile(imageUrl);
        if (deleted) {
          result.deletedFiles.push(imageUrl);
          result.deletedCount++;
        } else {
          result.errors.push(`Failed to delete image: ${imageUrl}`);
        }
      }
    }

    console.log(
      `[MediaCleanup] Listing ${listingId}: Deleted ${result.deletedCount} file(s), ${result.errors.length} error(s)`
    );
  } catch (error) {
    const errorMsg = `Unexpected error cleaning listing ${listingId}: ${error}`;
    console.error(`[MediaCleanup] ${errorMsg}`);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Clean up media for multiple listings
 */
export async function cleanupMultipleListingsMedia(
  listings: Array<{
    id: string;
    listingType: 'image' | 'video';
    images: string[];
    videoUrl?: string | null;
  }>
): Promise<CleanupSummary> {
  const summary: CleanupSummary = {
    totalListingsProcessed: 0,
    totalFilesDeleted: 0,
    totalErrors: 0,
    results: [],
  };

  console.log(`[MediaCleanup] Starting cleanup for ${listings.length} listing(s)...`);

  for (const listing of listings) {
    const result = await cleanupListingMedia(
      listing.id,
      listing.listingType,
      listing.images,
      listing.videoUrl
    );

    summary.results.push(result);
    summary.totalListingsProcessed++;
    summary.totalFilesDeleted += result.deletedCount;
    summary.totalErrors += result.errors.length;
  }

  console.log(
    `[MediaCleanup] Cleanup complete: ${summary.totalFilesDeleted} files deleted, ${summary.totalErrors} errors`
  );

  return summary;
}

/**
 * Check if a listing's media should be deleted
 * Returns true if listing expired > N days ago and hasn't been renewed
 */
export function shouldDeleteMedia(
  expiresAt: Date | null,
  mediaDeleteAfterDays: number = 60
): boolean {
  if (!expiresAt) return false;

  const now = new Date();
  const expiredDate = new Date(expiresAt);
  const daysSinceExpiry = Math.floor(
    (now.getTime() - expiredDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceExpiry >= mediaDeleteAfterDays;
}

/**
 * Get listings that need media cleanup
 * This would typically query your database
 */
export interface ListingForCleanup {
  id: string;
  listingType: 'image' | 'video';
  images: string[];
  videoUrl?: string | null;
  expiresAt: Date | null;
  mediaDeletedAt: Date | null;
}

export function filterListingsForCleanup(
  listings: ListingForCleanup[],
  mediaDeleteAfterDays: number = 60
): ListingForCleanup[] {
  return listings.filter((listing) => {
    // Skip if media already deleted
    if (listing.mediaDeletedAt) return false;

    // Check if cleanup needed
    return shouldDeleteMedia(listing.expiresAt, mediaDeleteAfterDays);
  });
}

/**
 * Scheduled job to run media cleanup
 * Call this periodically (e.g., daily via cron)
 */
export async function runScheduledMediaCleanup(
  getExpiredListings: () => Promise<ListingForCleanup[]>,
  markMediaAsDeleted: (listingIds: string[]) => Promise<void>,
  mediaDeleteAfterDays: number = 60
): Promise<CleanupSummary> {
  console.log('[MediaCleanup] Starting scheduled media cleanup job...');

  try {
    // Get all expired listings
    const expiredListings = await getExpiredListings();
    console.log(`[MediaCleanup] Found ${expiredListings.length} expired listing(s)`);

    // Filter to only those needing cleanup
    const listingsToCleanup = filterListingsForCleanup(expiredListings, mediaDeleteAfterDays);
    console.log(`[MediaCleanup] ${listingsToCleanup.length} listing(s) need media cleanup`);

    if (listingsToCleanup.length === 0) {
      return {
        totalListingsProcessed: 0,
        totalFilesDeleted: 0,
        totalErrors: 0,
        results: [],
      };
    }

    // Clean up media
    const summary = await cleanupMultipleListingsMedia(listingsToCleanup);

    // Mark listings as media deleted
    const cleanedListingIds = listingsToCleanup.map((l) => l.id);
    await markMediaAsDeleted(cleanedListingIds);

    console.log(`[MediaCleanup] Marked ${cleanedListingIds.length} listing(s) as media deleted`);

    return summary;
  } catch (error) {
    console.error('[MediaCleanup] Scheduled cleanup job failed:', error);
    throw error;
  }
}
