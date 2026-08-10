export type ImageCompressionPresetName = 'listing' | 'banner' | 'avatar' | 'icon';

export interface SharedImageCompressionPreset {
  maxDimension: number;
  quality: number;
  maxBytes: number;
  format: 'jpeg' | 'webp';
}

/**
 * The shared image policy used by web, admin, and mobile upload adapters.
 *
 * These are intentionally ceilings rather than promises about every source
 * image. The adapters keep already-small files when re-encoding would make
 * them larger, and reject an upload if a source cannot be brought under its
 * ceiling.
 */
export const IMAGE_COMPRESSION_PRESETS: Record<
  ImageCompressionPresetName,
  SharedImageCompressionPreset
> = {
  listing: {
    maxDimension: 1600,
    quality: 0.78,
    maxBytes: 1_500_000,
    format: 'jpeg',
  },
  banner: {
    maxDimension: 1920,
    quality: 0.82,
    maxBytes: 1_500_000,
    format: 'jpeg',
  },
  avatar: {
    maxDimension: 800,
    quality: 0.78,
    maxBytes: 500_000,
    format: 'jpeg',
  },
  icon: {
    maxDimension: 512,
    quality: 0.8,
    maxBytes: 350_000,
    format: 'webp',
  },
};

export function getImageCompressionPreset(
  preset: ImageCompressionPresetName = 'listing'
): SharedImageCompressionPreset {
  return IMAGE_COMPRESSION_PRESETS[preset];
}

export function fitImageWithinMaxDimension(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const ratio = Math.min(1, maxDimension / Math.max(safeWidth, safeHeight));

  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio)),
  };
}
