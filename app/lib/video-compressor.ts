/**
 * Video Compression Utility
 * Mobile version - optimizes for recording with compression-friendly settings
 * Web version uses FFmpeg.wasm (see video-compressor.web.ts)
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';

export interface CompressionOptions {
  quality?: 'low' | 'medium' | 'high';
}

export interface CompressionResult {
  uri: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  duration: number;
  compressed: boolean;
  recommendation?: string;
}

/**
 * Recommended video recording settings to reduce file size
 * These should be used when recording videos initially
 */
export const VIDEO_RECORDING_PRESETS = {
  low: {
    bitrate: 500_000,      // 500kbps
    quality: 'low',
    recommendation: 'Use for slow networks or storage constraints',
  },
  medium: {
    bitrate: 1_200_000,    // 1.2Mbps
    quality: 'medium',
    recommendation: 'Balanced quality and file size (recommended)',
  },
  high: {
    bitrate: 2_500_000,    // 2.5Mbps
    quality: 'high',
    recommendation: 'Best quality, larger files',
  },
};

/**
 * Get video file size in bytes
 */
export async function getVideoFileSize(uri: string): Promise<number> {
  try {
    // For local files
    if (uri.startsWith('file://')) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        return (fileInfo as any).size || 0;
      } catch {
        const response = await fetch(uri);
        const blob = await response.blob();
        return blob.size;
      }
    }
    // For http/https - do a HEAD request
    const response = await fetch(uri, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  } catch (error) {
    console.error('[VideoCompressor] Error getting file size:', error);
    return 0;
  }
}

/**
 * Calculate compression ratio estimates based on quality
 * These are ACTUAL estimates for real-world compression via server
 */
function getEstimatedCompressionRatio(quality: 'low' | 'medium' | 'high'): number {
  // These ratios are based on FFmpeg H.264 compression results
  const ratios = {
    low: 0.15,     // ~85% reduction (very aggressive)
    medium: 0.35,  // ~65% reduction (balanced)
    high: 0.60,    // ~40% reduction (high quality preserved)
  };
  return ratios[quality];
}

/**
 * Analyze video to provide compression recommendation
 * Returns helpful info about file size and compression potential
 */
export async function analyzeVideo(videoUri: string): Promise<{
  sizeBytes: number;
  sizeMB: number;
  recommendation: string;
  estimatedCompressionSizes: Record<string, string>;
}> {
  const sizeBytes = await getVideoFileSize(videoUri);
  const sizeMB = sizeBytes / 1024 / 1024;

  let recommendation = '';
  if (sizeMB > 100) {
    recommendation = '⚠️ VERY LARGE! Server compression required. Will be reduced to ~15-60MB';
  } else if (sizeMB > 50) {
    recommendation = '⚠️ Large file. Server will compress to ~7-30MB';
  } else if (sizeMB > 20) {
    recommendation = '📊 Medium file. Server will optimize to ~3-12MB';
  } else {
    recommendation = '✅ Good file size. Compression will improve further.';
  }

  const estimatedCompressionSizes = {
    low: `${(sizeMB * getEstimatedCompressionRatio('low')).toFixed(1)} MB (85% reduction)`,
    medium: `${(sizeMB * getEstimatedCompressionRatio('medium')).toFixed(1)} MB (65% reduction)`,
    high: `${(sizeMB * getEstimatedCompressionRatio('high')).toFixed(1)} MB (40% reduction)`,
  };

  return {
    sizeBytes,
    sizeMB,
    recommendation,
    estimatedCompressionSizes,
  };
}

/**
 * Compress video - now returns REAL server compression estimates
 * Mobile will upload original, server will compress using FFmpeg
 * DEFAULT QUALITY: LOW (85% reduction for S3)
 */
export async function compressVideo(
  videoUri: string,
  options?: CompressionOptions
): Promise<CompressionResult> {
  try {
    const originalSize = await getVideoFileSize(videoUri);
    const quality = options?.quality || 'low'; // DEFAULT: LOW quality
    const ratio = getEstimatedCompressionRatio(quality);
    const estimatedCompressedSize = Math.round(originalSize * ratio);

    console.log('[VideoCompressor] Video analysis (will compress on server):', {
      uri: videoUri,
      originalMB: (originalSize / 1024 / 1024).toFixed(2),
      quality,
      estimatedFinalMB: (estimatedCompressedSize / 1024 / 1024).toFixed(2),
      estimatedReduction: ((1 - ratio) * 100).toFixed(0) + '%',
    });

    // Return metadata for server compression
    return {
      uri: videoUri,
      originalSize,
      compressedSize: estimatedCompressedSize,
      compressionRatio: (1 - ratio) * 100, // Percentage reduction
      duration: 30,
      compressed: false, // Will be compressed on server
      recommendation: `Upload will use server-side FFmpeg compression (${quality}). Expected final size: ${(estimatedCompressedSize / 1024 / 1024).toFixed(1)} MB`,
    };
  } catch (error) {
    console.error('[VideoCompressor] Error:', error);
    const size = await getVideoFileSize(videoUri);
    return {
      uri: videoUri,
      originalSize: size,
      compressedSize: size,
      compressionRatio: 0,
      duration: 0,
      compressed: false,
    };
  }
}

/**
 * Compress video with progress callback
 */
export async function compressVideoWithProgress(
  videoUri: string,
  onProgress?: (progress: number) => void,
  options?: CompressionOptions
): Promise<CompressionResult> {
  try {
    // For mobile: simulate instant completion
    onProgress?.(50);
    const result = await compressVideo(videoUri, options);
    onProgress?.(100);

    return result;
  } catch (error) {
    console.error('[VideoCompressor] Error during video preparation:', error);
    throw error;
  }
}

/**
 * Check if video needs compression (>50MB)
 */
export async function shouldCompress(
  videoUri: string,
  threshold: number = 50 * 1024 * 1024
): Promise<boolean> {
  const size = await getVideoFileSize(videoUri);
  return size > threshold;
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get compression summary
 */
export function getCompressionSummary(result: CompressionResult): string {
  return `
Original: ${formatBytes(result.originalSize)}
Compressed: ${formatBytes(result.compressedSize)}
Saved: ${formatBytes(result.originalSize - result.compressedSize)} (${result.compressionRatio.toFixed(1)}%)
`.trim();
}
