import {
  fitImageWithinMaxDimension,
  getImageCompressionPreset,
  type ImageCompressionPresetName,
} from '../../../shared/media/image-compression';

export type { ImageCompressionPresetName } from '../../../shared/media/image-compression';

function getOutputFileName(fileName: string, format: 'jpeg' | 'webp'): string {
  const baseName = fileName.replace(/\.[^/.]+$/, '').trim() || 'nearhub-image';
  return `${baseName}.${format === 'webp' ? 'webp' : 'jpg'}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read image for compression'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: 'image/jpeg' | 'image/webp',
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed'))),
      mimeType,
      quality
    );
  });
}

/**
 * Compress a browser image before it reaches presigned storage.
 * The quality is reduced in small steps if the shared byte ceiling is not met.
 */
export async function compressImageFile(
  file: File,
  preset: ImageCompressionPresetName = 'listing'
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }

  const options = getImageCompressionPreset(preset);
  const image = await loadImage(file);
  const dimensions = fitImageWithinMaxDimension(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    options.maxDimension
  );
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to initialize image compression');

  const mimeType = options.format === 'webp' ? 'image/webp' : 'image/jpeg';
  if (mimeType === 'image/jpeg') {
    // JPEG has no alpha channel. Flatten transparent photos predictably.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, dimensions.width, dimensions.height);
  }
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

  let quality = options.quality;
  let blob = await canvasToBlob(canvas, mimeType, quality);
  for (let attempt = 0; blob.size > options.maxBytes && attempt < 6; attempt += 1) {
    quality = Math.max(0.35, quality - 0.08);
    blob = await canvasToBlob(canvas, mimeType, quality);
  }

  // An already-small source is preferable to making a tiny file larger.
  const sourceFits =
    file.size <= options.maxBytes &&
    dimensions.width === (image.naturalWidth || image.width) &&
    dimensions.height === (image.naturalHeight || image.height);
  if (sourceFits && blob.size >= file.size) return file;

  if (blob.size > options.maxBytes) {
    throw new Error(
      `Image could not be compressed below ${(options.maxBytes / 1024 / 1024).toFixed(1)} MB`
    );
  }

  return new File([blob], getOutputFileName(file.name, options.format), {
    type: mimeType,
    lastModified: Date.now(),
  });
}
