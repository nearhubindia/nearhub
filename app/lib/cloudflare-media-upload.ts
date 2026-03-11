import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getApiUrl } from '@/lib/query-client';

type MediaType = 'image' | 'video';

interface PresignRequest {
  mediaType: MediaType;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  userId?: string;
}

interface PresignResponse {
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  expiresInSeconds: number;
  headers: Record<string, string>;
}

export interface UploadedMedia {
  url: string;
  objectKey: string;
}

function isNativeLocalUri(uri: string): boolean {
  const normalized = uri.toLowerCase();
  return normalized.startsWith('file://') || normalized.startsWith('content://');
}

function inferMimeType(uri: string, mediaType: MediaType): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  return mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
}

function buildFileName(uri: string, mediaType: MediaType): string {
  const withoutQuery = uri.split('?')[0] || '';
  const lastSegment = withoutQuery.split('/').pop();
  if (lastSegment && lastSegment.includes('.')) {
    return lastSegment;
  }
  const extension = mediaType === 'video' ? 'mp4' : 'jpg';
  return `${mediaType}_${Date.now()}.${extension}`;
}

async function requestPresignedUpload(params: PresignRequest): Promise<PresignResponse> {
  const response = await fetch(`${getApiUrl()}/api/media/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || !payload?.data) {
    throw new Error(payload?.error || 'Failed to request upload URL');
  }

  return payload.data as PresignResponse;
}

async function uploadWithFetch(uploadUrl: string, contentType: string, uri: string): Promise<void> {
  const source = await fetch(uri);
  if (!source.ok) {
    throw new Error(`Failed to read media source (${source.status})`);
  }
  const blob = await source.blob();
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Cloudflare upload failed (${response.status})`);
  }
}

async function uploadWithNativeFileSystem(
  uploadUrl: string,
  contentType: string,
  uri: string
): Promise<void> {
  const result = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': contentType,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Cloudflare upload failed (${result.status})`);
  }
}

async function getFileSizeBytes(uri: string): Promise<number> {
  if (isNativeLocalUri(uri)) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && typeof (info as { size?: number }).size === 'number') {
      return (info as { size: number }).size;
    }
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to read media source (${response.status})`);
  }
  const blob = await response.blob();
  return blob.size;
}

export async function uploadMediaToCloudflare(params: {
  uri: string;
  mediaType: MediaType;
  fileName?: string;
  mimeType?: string;
  userId?: string;
}): Promise<UploadedMedia> {
  const fileName = params.fileName || buildFileName(params.uri, params.mediaType);
  const contentType = params.mimeType || inferMimeType(params.uri, params.mediaType);
  const fileSizeBytes = await getFileSizeBytes(params.uri);

  const signed = await requestPresignedUpload({
    mediaType: params.mediaType,
    fileName,
    contentType,
    fileSizeBytes,
    userId: params.userId,
  });

  const useNativeUpload =
    Platform.OS !== 'web' && isNativeLocalUri(params.uri) && !params.uri.startsWith('content://');

  if (useNativeUpload) {
    await uploadWithNativeFileSystem(signed.uploadUrl, contentType, params.uri);
  } else {
    await uploadWithFetch(signed.uploadUrl, contentType, params.uri);
  }

  return {
    url: signed.publicUrl,
    objectKey: signed.objectKey,
  };
}

export async function deleteCloudflareMedia(urls: string[]): Promise<void> {
  if (!urls.length) return;

  const response = await fetch(`${getApiUrl()}/api/media/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || 'Failed to delete media');
  }
}
