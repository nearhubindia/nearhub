import { getApiUrl } from '@/lib/config';

type MediaType = 'image' | 'video';

function getImageMimeType(file: File): string {
  if (file.type === 'image/png') return 'image/png';
  if (file.type === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

async function compressImageFile(file: File): Promise<File> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = imageUrl;
    });

    const maxDimension = 1920;
    const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const targetWidth = Math.max(1, Math.round(image.width * ratio));
    const targetHeight = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to initialize image compression context');
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    const mimeType = getImageMimeType(file);
    const quality = mimeType === 'image/jpeg' || mimeType === 'image/webp' ? 0.82 : undefined;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('Image compression failed'))),
        mimeType,
        quality
      );
    });

    return new File([blob], file.name, { type: mimeType });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function requestPresignedUpload(params: {
  mediaType: MediaType;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  const response = await fetch(`${getApiUrl()}/api/media/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
    data?: { uploadUrl?: string; publicUrl?: string };
  } | null;

  if (!response.ok || !payload?.success || !payload.data?.uploadUrl || !payload.data?.publicUrl) {
    throw new Error(payload?.error || 'Failed to create media upload URL');
  }

  return {
    uploadUrl: payload.data.uploadUrl,
    publicUrl: payload.data.publicUrl,
  };
}

async function uploadFileToCloudflare(file: File, mediaType: MediaType): Promise<string> {
  const contentType = file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
  const signed = await requestPresignedUpload({
    mediaType,
    fileName: file.name,
    contentType,
    fileSizeBytes: file.size,
  });

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    });
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }
    uploadResponse = await fetch(signed.uploadUrl, {
      method: 'PUT',
      body: file,
    });
  }

  if (!uploadResponse.ok) {
    throw new Error(`Media upload failed (${uploadResponse.status})`);
  }

  return signed.publicUrl;
}

export async function uploadListingImages(files: File[]): Promise<string[]> {
  const uploadedUrls: string[] = [];
  for (const file of files) {
    const compressedFile = await compressImageFile(file);
    uploadedUrls.push(await uploadFileToCloudflare(compressedFile, 'image'));
  }
  return uploadedUrls;
}

export async function uploadListingVideos(files: File[]): Promise<string[]> {
  const uploadedUrls: string[] = [];
  for (const file of files) {
    if (file.type !== 'video/mp4') {
      throw new Error('Only MP4 videos are supported');
    }
    uploadedUrls.push(await uploadFileToCloudflare(file, 'video'));
  }
  return uploadedUrls;
}
