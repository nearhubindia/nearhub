import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image as NativeImage } from 'react-native';
import {
  fitImageWithinMaxDimension,
  getImageCompressionPreset,
  type ImageCompressionPresetName,
} from '../../shared/media/image-compression';

export interface ImageCompressionResult {
  uri: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
  quality: number;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1, default 0.7
  format?: 'jpeg' | 'png' | 'webp';
  maxBytes?: number;
}

/**
 * Backwards-compatible names for existing UI code. The values come from the
 * shared compression policy instead of being maintained separately in mobile.
 */
export const QUALITY_PRESETS = {
  ultraLight: {
    ...getImageCompressionPreset('listing'),
    maxWidth: getImageCompressionPreset('listing').maxDimension,
    maxHeight: getImageCompressionPreset('listing').maxDimension,
    label: 'Listing optimized (< 1.5 MB)',
  },
  low: {
    ...getImageCompressionPreset('avatar'),
    maxWidth: getImageCompressionPreset('avatar').maxDimension,
    maxHeight: getImageCompressionPreset('avatar').maxDimension,
    label: 'Avatar optimized (< 500 KB)',
  },
  medium: {
    ...getImageCompressionPreset('banner'),
    maxWidth: getImageCompressionPreset('banner').maxDimension,
    maxHeight: getImageCompressionPreset('banner').maxDimension,
    label: 'Banner optimized (< 1.5 MB)',
  },
  high: {
    ...getImageCompressionPreset('icon'),
    maxWidth: getImageCompressionPreset('icon').maxDimension,
    maxHeight: getImageCompressionPreset('icon').maxDimension,
    label: 'Icon optimized (< 350 KB)',
  },
} as const;

export function getImageCompressionOptions(
  preset: ImageCompressionPresetName = 'listing'
): CompressionOptions {
  const options = getImageCompressionPreset(preset);
  return {
    maxWidth: options.maxDimension,
    maxHeight: options.maxDimension,
    quality: options.quality,
    maxBytes: options.maxBytes,
    format: options.format,
  };
}

/**
 * Get image file size in bytes
 */
export async function getImageFileSize(uri: string): Promise<number> {
  try {
    // Native/file-system available
    try {
      if (typeof FileSystem.getInfoAsync === 'function') {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        return (fileInfo as any).size || 0;
      }
    } catch (fsError) {
      // FileSystem not available on web - will use fallback below
      console.debug('FileSystem unavailable, using web fallback for file size');
    }

    // Web fallback: fetch blob and get size
    if (typeof fetch === 'function') {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      return (blob && (blob as any).size) || 0;
    }

    return 0;
  } catch (error) {
    console.error('Error getting image file size:', error);
    return 0;
  }
}

function getImageDimensions(imageUri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    NativeImage.getSize(imageUri, (width, height) => resolve({ width, height }), reject);
  });
}

/** Compress a single image using the shared policy. */
export async function compressImage(
  imageUri: string,
  options: CompressionOptions = {}
): Promise<ImageCompressionResult> {
  let finalUri: string | null = null;
  const generatedUris: string[] = [];

  try {
    const originalSize = await getImageFileSize(imageUri);
    const sharedOptions = getImageCompressionPreset('listing');
    const maxWidth = options.maxWidth ?? sharedOptions.maxDimension;
    const maxHeight = options.maxHeight ?? sharedOptions.maxDimension;
    const quality = options.quality ?? sharedOptions.quality;
    const maxBytes = options.maxBytes ?? sharedOptions.maxBytes;
    const format = options.format ?? 'jpeg';
    const sourceDimensions = await getImageDimensions(imageUri);
    const targetDimensions = fitImageWithinMaxDimension(
      sourceDimensions.width,
      sourceDimensions.height,
      Math.min(maxWidth, maxHeight)
    );
    const saveFormat =
      ImageManipulator.SaveFormat[format.toUpperCase() as keyof typeof ImageManipulator.SaveFormat];

    let currentQuality = quality;
    let manipulated: ImageManipulator.ImageResult | null = null;
    let compressedSize = 0;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: targetDimensions }],
        {
          compress: currentQuality,
          format: saveFormat,
          base64: false,
        }
      );
      generatedUris.push(manipulated.uri);
      compressedSize = await getImageFileSize(manipulated.uri);
      if (compressedSize <= maxBytes || currentQuality <= 0.35) break;
      currentQuality = Math.max(0.35, currentQuality - 0.08);
    }

    if (!manipulated || compressedSize > maxBytes) {
      throw new Error(
        `Image could not be compressed below ${(maxBytes / 1024 / 1024).toFixed(1)} MB`
      );
    }

    const sourceFits =
      originalSize > 0 &&
      originalSize <= maxBytes &&
      compressedSize >= originalSize &&
      targetDimensions.width === sourceDimensions.width &&
      targetDimensions.height === sourceDimensions.height;
    if (sourceFits) {
      finalUri = imageUri;
      return {
        uri: imageUri,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 100,
        width: sourceDimensions.width,
        height: sourceDimensions.height,
        quality: 1,
      };
    }

    finalUri = manipulated.uri;
    return {
      uri: manipulated.uri,
      originalSize,
      compressedSize,
      compressionRatio: originalSize > 0 ? (compressedSize / originalSize) * 100 : 0,
      width: manipulated.width,
      height: manipulated.height,
      quality: currentQuality,
    };
  } catch (error) {
    console.error('Image compression error:', error);
    throw error instanceof Error
      ? error
      : new Error('Unable to compress image. Please choose another image or try again.');
  } finally {
    await Promise.all(
      generatedUris
        .filter((uri) => uri !== finalUri && uri !== imageUri)
        .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined))
    );
  }
}

/**
 * Compress multiple images with progress callback
 */
export async function compressImagesWithProgress(
  imageUris: string[],
  onProgress: (progress: number, current: number, total: number) => void,
  options: CompressionOptions = {}
): Promise<ImageCompressionResult[]> {
  const results: ImageCompressionResult[] = [];
  const total = imageUris.length;

  for (let i = 0; i < total; i++) {
    const uri = imageUris[i];
    const result = await compressImage(uri, options);
    results.push(result);

    // Calculate progress (0-100)
    const progress = Math.round(((i + 1) / total) * 100);
    onProgress(progress, i + 1, total);
  }

  return results;
}

/**
 * Format file size comparison
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Should image be compressed (size > threshold)
 */
export async function shouldCompressImage(
  imageUri: string,
  threshold: number = 5 * 1024 * 1024 // 5MB default
): Promise<boolean> {
  try {
    const size = await getImageFileSize(imageUri);
    return size > threshold;
  } catch (error) {
    return true; // Assume compression needed if we can't check
  }
}

/**
 * Get compression summary for display
 */
export function getCompressionSummary(results: ImageCompressionResult[]): string {
  if (results.length === 0) return 'No images compressed';

  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0);
  const saved = totalOriginal - totalCompressed;
  const percent = Math.round((saved / totalOriginal) * 100);

  return `${results.length} image${results.length > 1 ? 's' : ''} compressed\nOriginal: ${formatBytes(totalOriginal)}\nCompressed: ${formatBytes(totalCompressed)}\nSaved: ${formatBytes(saved)} (${percent}%)`;
}

/**
 * Get individual image summary
 */
export function getImageSummary(result: ImageCompressionResult): string {
  const saved = result.originalSize - result.compressedSize;
  const percent = Math.round((saved / result.originalSize) * 100);

  return `${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)} (${percent}% smaller)`;
}

/**
 * Validate if image dimensions are reasonable
 */
export function validateImageDimensions(
  width: number,
  height: number,
  maxWidth: number = 4000,
  maxHeight: number = 4000
): { isValid: boolean; reason?: string } {
  if (width > maxWidth || height > maxHeight) {
    return {
      isValid: false,
      reason: `Image dimensions too large: ${width}x${height}. Max: ${maxWidth}x${maxHeight}`,
    };
  }

  if (width < 100 || height < 100) {
    return {
      isValid: false,
      reason: `Image too small: ${width}x${height}. Min: 100x100`,
    };
  }

  return { isValid: true };
}

/**
 * Estimate final size based on compression settings
 * Ultra-light: 8MB phone camera → ~100-150 KB
 * Quality 0.4, 600x600 typically achieves 1.5-2% of original size
 */
export function estimateCompressedSize(
  originalSize: number,
  quality: number = 0.4,
  scaleFactor: number = 0.36 // 600x600 from typical 3000x3000 = 0.36
): number {
  // Ultra-aggressive compression formula
  // Quality factor: 0.4 quality ≈ 20% of typical baseline
  // Resize factor: 0.36 = ~13% of pixels (very roughly 30% of size after resize)
  const sizeAfterQuality = originalSize * (quality * 0.5); // Very aggressive
  const sizeAfterResize = sizeAfterQuality * (scaleFactor * scaleFactor); // Pixel reduction

  // Cap at realistic minimums for different qualities
  const minSize = quality < 0.5 ? 80 * 1024 : quality < 0.7 ? 200 * 1024 : 400 * 1024; // Min KB values
  return Math.round(Math.max(sizeAfterResize, minSize));
}

/**
 * Get quality preset by name
 */
export function getQualityPreset(
  preset: 'ultraLight' | 'low' | 'medium' | 'high'
): (typeof QUALITY_PRESETS)[keyof typeof QUALITY_PRESETS] {
  return QUALITY_PRESETS[preset] as any;
}

/**
 * Create batch compression settings
 */
export function createBatchCompressionOptions(
  preset: 'ultraLight' | 'low' | 'medium' | 'high' = 'ultraLight'
): CompressionOptions {
  const p = QUALITY_PRESETS[preset] as any;
  return {
    quality: p.quality,
    maxWidth: p.maxWidth,
    maxHeight: p.maxHeight,
    maxBytes: p.maxBytes,
    format: p.format,
  };
}

/**
 * Calculate total batch compression statistics
 */
export function calculateBatchStats(results: ImageCompressionResult[]): {
  totalImages: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  totalSaved: number;
  averageCompressionPercent: number;
  compressionRatios: number[];
} {
  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0);
  const saved = totalOriginal - totalCompressed;
  const avgCompressionPercent = totalOriginal > 0 ? Math.round((saved / totalOriginal) * 100) : 0;
  const ratios = results.map((r) => r.compressionRatio);

  return {
    totalImages: results.length,
    totalOriginalSize: totalOriginal,
    totalCompressedSize: totalCompressed,
    totalSaved: saved,
    averageCompressionPercent: avgCompressionPercent,
    compressionRatios: ratios,
  };
}
