import { compressImageFile } from '@/lib/image-compression';
import { uploadImageToBackend } from '@/lib/media-upload';

export async function uploadImagesWithPreset(
  files: File[],
  preset: 'listing' | 'banner' = 'listing'
): Promise<string[]> {
  const uploadedUrls: string[] = [];
  for (const file of files) {
    const compressedFile = await compressImageFile(file, preset);
    uploadedUrls.push(await uploadImageToBackend(compressedFile, { preset }));
  }
  return uploadedUrls;
}

export function uploadListingImages(files: File[]): Promise<string[]> {
  return uploadImagesWithPreset(files, 'listing');
}

export function uploadBannerImages(files: File[]): Promise<string[]> {
  return uploadImagesWithPreset(files, 'banner');
}

export async function uploadListingVideos(files: File[]): Promise<string[]> {
  void files;
  throw new Error('Video uploads are no longer supported');
}
