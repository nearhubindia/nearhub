import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

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
}

/**
 * Quality presets for image compression
 */
export const QUALITY_PRESETS = {
  ultraLight: {
    quality: 0.4,
    maxWidth: 600,
    maxHeight: 600,
    label: 'Ultra Light (< 150 KB)',
  },
  low: {
    quality: 0.5,
    maxWidth: 800,
    maxHeight: 800,
    label: 'Low (< 250 KB)',
  },
  medium: {
    quality: 0.65,
    maxWidth: 1024,
    maxHeight: 1024,
    label: 'Medium (< 400 KB)',
  },
  high: {
    quality: 0.8,
    maxWidth: 1280,
    maxHeight: 1280,
    label: 'High (< 600 KB)',
  },
} as const;

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

/**
 * Compress a single image
 */
export async function compressImage(
  imageUri: string,
  options: CompressionOptions = {}
): Promise<ImageCompressionResult> {
  try {
    const originalSize = await getImageFileSize(imageUri);

    // Default options - ultra light for fast upload
    const maxWidth = options.maxWidth ?? QUALITY_PRESETS.ultraLight.maxWidth;
    const maxHeight = options.maxHeight ?? QUALITY_PRESETS.ultraLight.maxHeight;
    const quality = options.quality ?? QUALITY_PRESETS.ultraLight.quality;
    const format = options.format ?? 'jpeg';

    // Get image dimensions
    let width = maxWidth;
    let height = maxHeight;

    // Manipulate and compress the image
    const manipulated = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          resize: {
            width: maxWidth,
            height: maxHeight,
          },
        },
      ],
      {
        compress: quality,
        format:
          ImageManipulator.SaveFormat[
            format.toUpperCase() as keyof typeof ImageManipulator.SaveFormat
          ],
        base64: false,
      }
    );

    const compressedSize = await getImageFileSize(manipulated.uri);

    return {
      uri: manipulated.uri,
      originalSize,
      compressedSize,
      compressionRatio: (compressedSize / originalSize) * 100,
      width,
      height,
      quality,
    };
  } catch (error) {
    console.error('Image compression error:', error);
    // Fallback: return original with metadata
    const size = await getImageFileSize(imageUri);
    return {
      uri: imageUri,
      originalSize: size,
      compressedSize: size,
      compressionRatio: 100,
      width: QUALITY_PRESETS.medium.maxWidth,
      height: QUALITY_PRESETS.medium.maxHeight,
      quality: 1,
    };
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
    format: 'jpeg',
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
