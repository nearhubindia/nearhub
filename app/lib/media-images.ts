import * as FileSystem from 'expo-file-system/legacy';
import { uploadMediaToCloudflare } from '@/lib/cloudflare-media-upload';

interface UploadImageOptions {
  fileNamePrefix?: string;
  userId?: string;
}

export function getMimeTypeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export function isRemoteMediaUrl(uri: string): boolean {
  return uri.startsWith('http://') || uri.startsWith('https://');
}

async function blobUrlToDataUri(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function toPortableImageUri(uri: string): Promise<string> {
  if (!uri) return uri;

  if (
    uri.startsWith('data:image/') ||
    isRemoteMediaUrl(uri) ||
    uri.startsWith('/uploads/') ||
    uri.startsWith('/images/')
  ) {
    return uri;
  }

  if (uri.startsWith('blob:')) {
    return blobUrlToDataUri(uri);
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:${getMimeTypeFromUri(uri)};base64,${base64}`;
  } catch {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      throw new Error('Unable to process selected image for upload');
    }
  }
}

export async function uploadImagesToCloudflare(
  uris: string[],
  options: UploadImageOptions = {}
): Promise<string[]> {
  const uploaded: string[] = [];
  const fileNamePrefix = options.fileNamePrefix || 'listing_image';

  for (let index = 0; index < uris.length; index++) {
    const uri = uris[index] || '';
    if (!uri) continue;
    if (isRemoteMediaUrl(uri)) {
      uploaded.push(uri);
      continue;
    }

    const fileName = `${fileNamePrefix}_${Date.now()}_${index}.jpg`;
    const media = await uploadMediaToCloudflare({
      uri,
      mediaType: 'image',
      fileName,
      userId: options.userId,
    });

    uploaded.push(media.url);
  }

  return uploaded;
}
