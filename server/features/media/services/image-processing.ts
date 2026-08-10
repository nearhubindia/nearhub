import sharp from 'sharp';
import {
  getImageCompressionPreset,
  type ImageCompressionPresetName,
  type SharedImageCompressionPreset,
} from '../../../../shared/media/image-compression';

export type ServerImageCompressionPreset = ImageCompressionPresetName;

export interface ProcessedImage {
  buffer: Buffer;
  contentType: 'image/jpeg' | 'image/webp';
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
}

function getPreset(value: string | undefined): SharedImageCompressionPreset {
  const preset = value as ServerImageCompressionPreset;
  const isKnownPreset =
    preset === 'listing' || preset === 'banner' || preset === 'avatar' || preset === 'icon';
  return getImageCompressionPreset(isKnownPreset ? preset : 'listing');
}

async function encodeImage(
  source: ReturnType<typeof sharp>,
  format: 'jpeg' | 'webp',
  quality: number
): Promise<Buffer> {
  const encoder = source.clone();
  return format === 'webp'
    ? encoder.webp({ quality: Math.round(quality * 100), effort: 4 }).toBuffer()
    : encoder.jpeg({ quality: Math.round(quality * 100), mozjpeg: true }).toBuffer();
}

export async function processImageBuffer(
  input: Buffer,
  presetName?: string
): Promise<ProcessedImage> {
  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw new Error('Image body is empty');
  }

  const preset = getPreset(presetName);
  const source = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate();
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  const resized = source.resize({
    width: preset.maxDimension,
    height: preset.maxDimension,
    fit: 'inside',
    withoutEnlargement: true,
  });

  let quality = preset.quality;
  let output = await encodeImage(resized, preset.format, quality);
  for (let attempt = 0; output.length > preset.maxBytes && attempt < 7; attempt += 1) {
    quality = Math.max(0.35, quality - 0.08);
    output = await encodeImage(resized, preset.format, quality);
  }

  if (output.length > preset.maxBytes) {
    throw new Error(
      `Image could not be normalized below ${(preset.maxBytes / 1024 / 1024).toFixed(1)} MB`
    );
  }

  const outputMetadata = await sharp(output).metadata();
  return {
    buffer: output,
    contentType: preset.format === 'webp' ? 'image/webp' : 'image/jpeg',
    originalBytes: input.length,
    compressedBytes: output.length,
    width: outputMetadata.width || metadata.width,
    height: outputMetadata.height || metadata.height,
  };
}
