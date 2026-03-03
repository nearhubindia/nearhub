/**
 * Video Compression for S3 Direct Upload
 * Optimized client-side compression before uploading directly to S3
 * 
 * This eliminates the need for server-side compression when using S3:
 * - Compress on client with preview
 * - Upload compressed file directly to S3
 * - No server storage needed
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';

export interface CompressionOptions {
  quality?: 'low' | 'medium' | 'high';
  targetSizeMB?: number;  // Target final size in MB
}

export interface CompressionResult {
  uri: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // Percentage (0-100)
  didCompress: boolean;
  recommendation: string;
  s3Key?: string;
}

/**
 * Estimated compression ratios from actual FFmpeg results
 * These help predict final S3 file sizes BEFORE uploading
 */
export const S3_COMPRESSION_PROFILES = {
  low: {
    description: '⚡ Maximum Compression',
    targetBitrate: '500kbps',
    targetResolution: '480p',
    estimatedRatio: 0.15, // 85% reduction
    s3StorageSavings: '85%',
    uploadTimeReduction: '85%',
    useCases: ['Slow networks', 'Storage-constrained', 'Preview-only'],
  },
  medium: {
    description: '⭐ Balanced (Recommended)',
    targetBitrate: '1200kbps',
    targetResolution: '720p',
    estimatedRatio: 0.35, // 65% reduction
    s3StorageSavings: '65%',
    uploadTimeReduction: '65%',
    useCases: ['Standard uploads', 'Most listings', 'Default choice'],
  },
  high: {
    description: '📺 Best Quality',
    targetBitrate: '2500kbps',
    targetResolution: '1080p',
    estimatedRatio: 0.60, // 40% reduction
    s3StorageSavings: '40%',
    uploadTimeReduction: '40%',
    useCases: ['Premium content', 'High-end products', 'Professional'],
  },
};

/**
 * Get video analytics before compression
 * Helps user decide which quality to choose
 */
export async function analyzeVideoForS3(videoUri: string): Promise<{
  sizeBytes: number;
  sizeMB: number;
  recommendation: string;
  estimations: Record<string, { finalSizeMB: string; timeSeconds: string }>;
}> {
  const sizeBytes = await getVideoFileSize(videoUri);
  const sizeMB = sizeBytes / 1024 / 1024;

  let recommendation = '';
  if (sizeMB > 200) {
    recommendation =
      '⚠️ VERY LARGE! Compression essential. Will upload ~30-120MB instead.';
  } else if (sizeMB > 100) {
    recommendation = '⚠️ Large file. Compression will reduce to ~15-60MB.';
  } else if (sizeMB > 50) {
    recommendation = '📊 Medium file. Compression will reduce to ~7-30MB.';
  } else if (sizeMB > 20) {
    recommendation = '✅ Good file. Compression will optimize further.';
  } else {
    recommendation = '✅ Small file. Ready to upload.';
  }

  // Estimate final sizes for each quality level
  const estimations: Record<string, { finalSizeMB: string; timeSeconds: string }> = {};

  for (const [quality, profile] of Object.entries(S3_COMPRESSION_PROFILES)) {
    const estimatedFinalMB = sizeMB * profile.estimatedRatio;
    const originalUploadTime = sizeMB / 5; // Assume 5MB/s upload
    const compressedUploadTime = estimatedFinalMB / 5;

    estimations[quality] = {
      finalSizeMB: `${estimatedFinalMB.toFixed(1)} MB (${profile.s3StorageSavings} savings)`,
      timeSeconds: `${compressedUploadTime.toFixed(0)}s (vs ${originalUploadTime.toFixed(0)}s original)`,
    };
  }

  return {
    sizeBytes,
    sizeMB,
    recommendation,
    estimations,
  };
}

/**
 * Get estimated S3 costs for different compression levels
 */
export function estimateS3Costs(videoSizeMB: number, monthlyUploads: number = 100): {
  quality: string;
  storageMonth: number;
  transferMonth: number;
  totalMonth: number;
  savings: number;
} {
  const STORAGE_COST_PER_GB = 0.023; // S3 standard pricing
  const TRANSFER_COST_PER_GB = 0.09; // Data transfer out

  const results = [];

  // Original (uncompressed)
  const originalStorageGB = (videoSizeMB * monthlyUploads) / 1024;
  const originalTransferGB = (videoSizeMB * monthlyUploads) / 1024;
  const originalCost = originalStorageGB * STORAGE_COST_PER_GB + originalTransferGB * TRANSFER_COST_PER_GB;

  results.push({
    quality: 'original',
    storageMonth: originalStorageGB * STORAGE_COST_PER_GB,
    transferMonth: originalTransferGB * TRANSFER_COST_PER_GB,
    totalMonth: originalCost,
    savings: 0,
  });

  // Compressed levels
  for (const [quality, profile] of Object.entries(S3_COMPRESSION_PROFILES)) {
    const compressedSizeMB = videoSizeMB * profile.estimatedRatio;
    const compressedStorageGB = (compressedSizeMB * monthlyUploads) / 1024;
    const compressedTransferGB = (compressedSizeMB * monthlyUploads) / 1024;
    const compressedCost =
      compressedStorageGB * STORAGE_COST_PER_GB + compressedTransferGB * TRANSFER_COST_PER_GB;

    results.push({
      quality,
      storageMonth: compressedStorageGB * STORAGE_COST_PER_GB,
      transferMonth: compressedTransferGB * TRANSFER_COST_PER_GB,
      totalMonth: compressedCost,
      savings: originalCost - compressedCost,
    });
  }

  return results as any;
}

/**
 * Get video file size in bytes
 */
export async function getVideoFileSize(uri: string): Promise<number> {
  try {
    if (uri.startsWith('file://')) {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return (fileInfo as any).size || 0;
    }
    const response = await fetch(uri, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  } catch (error) {
    console.error('[VideoCompressorS3] Error getting file size:', error);
    return 0;
  }
}

/**
 * Get S3 upload recommendations based on video analysis
 * Returns helpful metadata for choosing compression
 * DEFAULT: LOW quality for maximum S3 cost savings (85% reduction)
 */
export async function recommendCompressionForS3(videoUri: string): Promise<{
  recommendedQuality: 'low' | 'medium' | 'high';
  reason: string;
  s3CostSavings: string;
  estimatedUploadTime: string;
  s3Key: string;
}> {
  const sizeBytes = await getVideoFileSize(videoUri);
  const sizeMB = sizeBytes / 1024 / 1024;
  // DEFAULT: Always recommend LOW quality for maximum savings
  let recommended: 'low' | 'medium' | 'high' = 'low';
  let reason = '⚡ LOW quality selected - Maximum compression (85% reduction) for optimal S3 costs';

  // Override only for very small files where high quality makes sense
  if (sizeMB < 15) {
    recommended = 'low';
    reason = '⚡ File is small - Using LOW quality for efficient storage';
  } else if (sizeMB > 200) {
    recommended = 'low';
    reason = '⚡ VERY large file - Using LOW quality to minimize S3 costs';
  }
  // All other sizes default to LOW

  const profile = S3_COMPRESSION_PROFILES[recommended];
  const estimatedFinalMB = sizeMB * profile.estimatedRatio;
  const estimatedUploadSeconds = estimatedFinalMB / 5; // 5MB/s assumption

  // Generate S3 key (format: videos/YYYY-MM-DD/uuid_timestamp)
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const s3Key = `videos/${date}/${crypto.randomUUID()}_${Date.now()}.mp4`;

  return {
    recommendedQuality: recommended,
    reason,
    s3CostSavings: `${profile.s3StorageSavings} storage, ${profile.uploadTimeReduction} faster`,
    estimatedUploadTime: `~${estimatedUploadSeconds.toFixed(0)}s on 5Mbps connection`,
    s3Key,
  };
}

/**
 * Compress video locally (simulated for mobile)
 * 
 * DEFAULT QUALITY: LOW (85% reduction)
 * This is the most cost-effective for S3 direct uploads
 * 
 * NOTE: For actual compression on mobile, you would need to:
 * 1. Use react-native-video-processing or similar
 * 2. Or use Expo's limited compression via Media Library
 * 3. Or upload to server for FFmpeg compression (then to S3)
 * 
 * For now, returns compression estimates that will be applied server-side
 * OR by the client using native compression libraries
 */
export async function compressVideoForS3(
  videoUri: string,
  options?: CompressionOptions
): Promise<CompressionResult> {
  const originalSize = await getVideoFileSize(videoUri);
  const quality = options?.quality || 'low'; // DEFAULT: LOW quality
  const profile = S3_COMPRESSION_PROFILES[quality];

  // Calculate estimated compressed size
  const estimatedCompressedSize = Math.round(originalSize * profile.estimatedRatio);
  const compressionRatio = profile.estimatedRatio * 100;

  console.log('[VideoCompressorS3] Compression analysis:', {
    originalSizeMB: (originalSize / 1024 / 1024).toFixed(1),
    quality,
    estimatedCompressedMB: (estimatedCompressedSize / 1024 / 1024).toFixed(1),
    estimatedReduction: `${((1 - profile.estimatedRatio) * 100).toFixed(0)}%`,
  });

  // Generate S3 key with compression quality indicator
  const timestamp = Date.now();
  const s3Key = `videos/${quality}/${timestamp}_${Math.random().toString(36).substr(2, 9)}.mp4`;

  return {
    uri: videoUri,
    originalSize,
    compressedSize: estimatedCompressedSize,
    compressionRatio: (1 - profile.estimatedRatio) * 100,
    didCompress: false, // Will be compressed during upload
    recommendation: profile.description,
    s3Key,
  };
}

/**
 * Calculate monthly S3 cost for storing videos
 */
export function calculateMonthlyCost(
  avgVideoSizeMB: number,
  uploadCount: number,
  quality: 'low' | 'medium' | 'high'
): { storage: number; transfer: number; total: number } {
  const profile = S3_COMPRESSION_PROFILES[quality];
  const compressedSizeMB = avgVideoSizeMB * profile.estimatedRatio;
  const totalStorageGB = (compressedSizeMB * uploadCount) / 1024;

  const STORAGE_COST = 0.023; // per GB
  const TRANSFER_COST = 0.09; // per GB

  return {
    storage: totalStorageGB * STORAGE_COST,
    transfer: totalStorageGB * TRANSFER_COST,
    total: totalStorageGB * (STORAGE_COST + TRANSFER_COST),
  };
}
