/**
 * Video Streaming Service
 * Provides cached video streaming with HTTP range request support (206 Partial Content)
 * Caches video metadata in Redis for faster delivery
 */

import * as fs from 'fs';
import * as path from 'path';
import { redisCache } from '../../../shared/cache/redis-cache';
import type { Request, Response } from 'express';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/video-uploads';
const VIDEO_CACHE_TTL = 3600; // 1 hour cache for video metadata

export interface VideoMetadata {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  resolution: string; // e.g., "480p"
  duration?: number; // Optional: duration in seconds
  uploadedAt: Date;
  lastAccessed: Date;
}

/**
 * Get video metadata from cache or filesystem
 */
export async function getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  const cacheKey = `video:metadata:${videoId}`;

  try {
    // Try to get from Redis cache first
    const cached = await redisCache.get<VideoMetadata>(cacheKey);
    if (cached) {
      console.log(`[VideoStreaming] Cache HIT for ${videoId}`);
      // Update last accessed time
      cached.lastAccessed = new Date();
      await redisCache.set(cacheKey, cached, { ttl: VIDEO_CACHE_TTL });
      return cached;
    }

    console.log(`[VideoStreaming] Cache MISS for ${videoId}`);

    // Not in cache, get from filesystem
    const filePath = path.join(UPLOAD_DIR, videoId);

    if (!fs.existsSync(filePath)) {
      console.error(`[VideoStreaming] Video not found: ${videoId}`);
      return null;
    }

    const stats = fs.statSync(filePath);
    const metadata: VideoMetadata = {
      filePath,
      fileName: videoId,
      fileSize: stats.size,
      mimeType: getMimeType(videoId),
      resolution: '480p', // Standard resolution
      uploadedAt: stats.birthtime,
      lastAccessed: new Date(),
    };

    // Cache the metadata
    await redisCache.set(cacheKey, metadata, { ttl: VIDEO_CACHE_TTL });

    return metadata;
  } catch (error) {
    console.error(`[VideoStreaming] Error getting metadata for ${videoId}:`, error);
    return null;
  }
}

/**
 * Stream video with HTTP range request support (206 Partial Content)
 */
export async function streamVideo(req: Request, res: Response, videoId: string): Promise<void> {
  try {
    const metadata = await getVideoMetadata(videoId);

    if (!metadata) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const { filePath, fileSize, mimeType } = metadata;

    // Parse range header
    const range = req.headers.range;

    if (!range) {
      // No range requested, send entire file
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      console.log(`[VideoStreaming] Streaming full video: ${videoId}`);
      return;
    }

    // Parse range (e.g., "bytes=0-1023")
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    // Validate range
    if (start >= fileSize || end >= fileSize) {
      res.status(416).json({ error: 'Range not satisfiable' });
      return;
    }

    // Send partial content (HTTP 206)
    res.status(206);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const fileStream = fs.createReadStream(filePath, { start, end });
    fileStream.pipe(res);

    console.log(`[VideoStreaming] Streaming range ${start}-${end}/${fileSize} for ${videoId}`);
  } catch (error) {
    console.error(`[VideoStreaming] Error streaming video ${videoId}:`, error);
    res.status(500).json({ error: 'Failed to stream video' });
  }
}

/**
 * Get video thumbnail URL (cached)
 */
export async function getVideoThumbnail(videoId: string): Promise<string | null> {
  const cacheKey = `video:thumbnail:${videoId}`;

  try {
    // Try cache first
    const cached = await redisCache.get<string>(cacheKey);
    if (cached) return cached;

    // Generate thumbnail URL (placeholder for now)
    // In production, you'd generate actual thumbnails
    const thumbnailUrl = `/videos/thumbnails/${videoId}.jpg`;

    // Cache for 24 hours
    await redisCache.set(cacheKey, thumbnailUrl, { ttl: 86400 });

    return thumbnailUrl;
  } catch (error) {
    console.error(`[VideoStreaming] Error getting thumbnail for ${videoId}:`, error);
    return null;
  }
}

/**
 * Cache video URLs for faster access
 */
export async function cacheVideoUrl(listingId: string, videoUrl: string): Promise<void> {
  const cacheKey = `listing:video:${listingId}`;
  await redisCache.set(cacheKey, videoUrl, { ttl: 3600 });
}

/**
 * Get cached video URL
 */
export async function getCachedVideoUrl(listingId: string): Promise<string | null> {
  const cacheKey = `listing:video:${listingId}`;
  return await redisCache.get<string>(cacheKey);
}

/**
 * Invalidate video cache when video is deleted
 */
export async function invalidateVideoCache(videoId: string): Promise<void> {
  const metadataKey = `video:metadata:${videoId}`;
  const thumbnailKey = `video:thumbnail:${videoId}`;

  await redisCache.delete(metadataKey);
  await redisCache.delete(thumbnailKey);

  console.log(`[VideoStreaming] Invalidated cache for ${videoId}`);
}

/**
 * Get streaming statistics
 */
export async function getStreamingStats(): Promise<{
  totalRequests: number;
  cacheHitRate: number;
  averageFileSize: number;
}> {
  // In production, track these metrics with Redis counters
  const stats = redisCache.getStats();

  return {
    totalRequests: stats.hits + stats.misses,
    cacheHitRate: stats.hits / (stats.hits + stats.misses || 1),
    averageFileSize: 5 * 1024 * 1024, // 5MB estimate
  };
}

/**
 * Helper: Get MIME type from file extension
 */
function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };
  return mimeTypes[ext] || 'video/mp4';
}

/**
 * Pre-cache popular videos (e.g., trending listings)
 */
export async function precachePopularVideos(videoIds: string[]): Promise<void> {
  console.log(`[VideoStreaming] Pre-caching ${videoIds.length} videos...`);

  for (const videoId of videoIds) {
    await getVideoMetadata(videoId); // This will cache it
  }

  console.log(`[VideoStreaming] Pre-caching complete`);
}
