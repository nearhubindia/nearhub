import { getApiUrl } from '@/lib/config';
import { WEB_TOKEN_STORAGE_KEY } from '@/lib/web-auth-storage';
import type { ImageCompressionPresetName } from '../../../shared/media/image-compression';

interface BackendImageUploadOptions {
  preset?: ImageCompressionPresetName;
  fileName?: string;
  userId?: string;
}

interface BackendImageUploadResponse {
  success?: boolean;
  error?: string;
  data?: { publicUrl?: string };
}

function getStoredMediaAuthToken(preferUserSession: boolean): string {
  try {
    const adminToken = String(localStorage.getItem('adminToken') || '').trim();
    const userToken = String(localStorage.getItem(WEB_TOKEN_STORAGE_KEY) || '').trim();
    // A user-scoped upload must use the user JWT when both sessions exist in
    // the same browser; admin-only uploads use the admin JWT.
    return preferUserSession ? userToken || adminToken : adminToken || userToken;
  } catch {
    return '';
  }
}

/**
 * Sends a client-compressed image to the backend for authoritative
 * normalization before the image is written to R2.
 */
export async function uploadImageToBackend(
  file: File,
  options: BackendImageUploadOptions = {}
): Promise<string> {
  const url = new URL('/api/media/upload-image', getApiUrl());
  url.searchParams.set('preset', options.preset || 'listing');
  url.searchParams.set('fileName', options.fileName || file.name || 'image');

  const headers: Record<string, string> = {
    'Content-Type': file.type || 'image/jpeg',
  };
  const token = getStoredMediaAuthToken(Boolean(options.userId));
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.userId) headers['x-user-id'] = options.userId;

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: file,
  });
  const payload = (await response.json().catch(() => null)) as BackendImageUploadResponse | null;
  const publicUrl = payload?.data?.publicUrl;
  if (!response.ok || !payload?.success || !publicUrl) {
    throw new Error(payload?.error || `Image upload failed (${response.status})`);
  }

  return publicUrl;
}
