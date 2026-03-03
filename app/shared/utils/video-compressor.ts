/**
 * Video Compression Utility
 * For Expo Go compatibility, uses graceful degradation
 * (compression requires native modules; falls back to original video)
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';

export interface CompressionOptions {
  bitrate?: number;
  maxDuration?: number;
  quality?: 'low' | 'medium' | 'high';
}

export interface CompressionResult {
  uri: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  duration: number;
  compressed: boolean; // true if actually compressed, false if returned as-is
}

/**
 * Get video file size in MB
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
 * Compress video file
 * For Expo Go: returns video as-is (compression requires native modules)
 * Default settings: 480p resolution, 1.3Mbps bitrate (suitable for 30sec shorts, ~5MB max)
 */
export async function compressVideo(
  videoUri: string,
  options?: CompressionOptions
): Promise<CompressionResult> {
  try {
    const originalSize = await getVideoFileSize(videoUri);

    console.log('[VideoCompressor] Video prepared for upload:', {
      uri: videoUri,
      sizeMB: (originalSize / 1024 / 1024).toFixed(2),
      note: 'Using original video (compression requires native modules, unavailable in Expo Go)',
    });

    // In Expo Go, return the video as-is
    // Native compression would require react-native-compressor which isn't available
    return {
      uri: videoUri,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      duration: options?.maxDuration ?? 30,
      compressed: false, // Not actually compressed
    };
  } catch (error) {
    console.error('[VideoCompressor] Error preparing video:', error);
    // Return original URI if anything fails
    const originalSize = await getVideoFileSize(videoUri);
    return {
      uri: videoUri,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      duration: options?.maxDuration ?? 30,
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
    // For Expo Go: simulate instant completion
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
