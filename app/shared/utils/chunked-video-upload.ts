/**
 * Chunked Video Upload Utility
 * Handles splitting videos into chunks and uploading them to the server
 * with progress tracking and resume capability
 */

import * as FileSystem from 'expo-file-system/legacy';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export interface UploadProgress {
  uploadId: string;
  chunksUploaded: number;
  totalChunks: number;
  progress: number;
  isComplete: boolean;
}

export interface ChunkedUploadResult {
  videoUrl: string;
  uploadId: string;
  fileSize: number;
  duration: number;
}

/**
 * Get the size of a video file
 */
export async function getVideoSize(videoUri: string): Promise<number> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    return (fileInfo as any).size || 0;
  } catch (error) {
    console.error('[ChunkedUpload] Error getting video size:', error);
    throw new Error('Failed to get video file size');
  }
}

/**
 * Read a chunk of the video file
 */
async function readVideoChunk(
  videoUri: string,
  startByte: number,
  endByte: number
): Promise<string> {
  try {
    // For Expo, we need to use the FileSystem API to read binary chunks
    // Since FileSystem doesn't have direct binary read, we'll read as base64
    // and convert specific byte range

    const fileSize = await getVideoSize(videoUri);

    if (startByte >= fileSize) {
      throw new Error('Start byte exceeds file size');
    }

    const actualEndByte = Math.min(endByte, fileSize);
    const chunkLength = actualEndByte - startByte;

    // Read the entire file is not efficient, but fetch API can handle streaming
    // Let's use fetch which works in Expo for file:// URIs
    const response = await fetch(videoUri);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const chunkData = uint8Array.slice(startByte, actualEndByte);

    // Convert to base64 for transmission (fallback to Buffer if btoa isn't available)
    const toBase64 = (u8: Uint8Array) => {
      if (typeof btoa === 'function') {
        // chunking to avoid call stack limits
        const CHUNK = 0x8000;
        let result = '';
        for (let i = 0; i < u8.length; i += CHUNK) {
          result += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CHUNK)));
        }
        return btoa(result);
      }
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(u8).toString('base64');
      }
      throw new Error('No base64 encoder available in this environment');
    };

    return toBase64(chunkData);
  } catch (error) {
    console.error('[ChunkedUpload] Error reading video chunk:', error);
    throw error;
  }
}

/**
 * Initialize upload session on server
 */
async function initiateUpload(
  fileName: string,
  totalChunks: number,
  fileSize: number
): Promise<{ uploadId: string; chunkSize: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/videos/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        totalChunks,
        fileSize,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[ChunkedUpload] Upload initiated:', data.uploadId);
    return data;
  } catch (error) {
    console.error('[ChunkedUpload] Error initiating upload:', error);
    throw new Error('Failed to initiate upload');
  }
}

/**
 * Upload a single chunk to the server
 */
async function uploadSingleChunk(
  uploadId: string,
  chunkIndex: number,
  chunkBase64: string
): Promise<UploadProgress> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/videos/upload-chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        chunkIndex,
        chunkData: chunkBase64,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Upload failed');
    }

    console.log(
      `[ChunkedUpload] Chunk ${chunkIndex + 1} uploaded, progress: ${data.progress.progress}%`
    );

    return data.progress;
  } catch (error) {
    console.error(`[ChunkedUpload] Error uploading chunk ${chunkIndex}:`, error);
    throw error;
  }
}

/**
 * Check upload progress on server
 */
export async function checkUploadProgress(uploadId: string): Promise<UploadProgress> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/videos/progress/${uploadId}`);

    if (!response.ok) {
      throw new Error('Upload session not found');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[ChunkedUpload] Error checking progress:', error);
    throw error;
  }
}

/**
 * Finalize upload and merge chunks
 */
async function finalizeUpload(uploadId: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/videos/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Finalization failed');
    }

    console.log('[ChunkedUpload] Upload finalized, videoUrl:', data.videoUrl);
    return data.videoUrl;
  } catch (error) {
    console.error('[ChunkedUpload] Error finalizing upload:', error);
    throw new Error('Failed to finalize upload');
  }
}

/**
 * Cancel upload and cleanup on server
 */
export async function cancelUpload(uploadId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/videos/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log('[ChunkedUpload] Upload cancelled:', uploadId);
  } catch (error) {
    console.error('[ChunkedUpload] Error cancelling upload:', error);
    throw error;
  }
}

/**
 * Upload video in chunks with progress callback
 */
export async function uploadVideoInChunks(
  videoUri: string,
  fileName: string,
  onProgress?: (progress: UploadProgress) => void,
  onError?: (error: Error) => void
): Promise<ChunkedUploadResult> {
  let uploadId: string | null = null;

  try {
    const fileSize = await getVideoSize(videoUri);

    if (fileSize === 0) {
      throw new Error('Video file is empty');
    }

    // Calculate number of chunks (aim for 5MB chunks)
    const totalChunks = Math.max(1, Math.ceil(fileSize / CHUNK_SIZE));

    console.log(
      `[ChunkedUpload] Starting upload: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB in ${totalChunks} chunks)`
    );

    // Initiate upload session
    const { uploadId: sessionId } = await initiateUpload(fileName, totalChunks, fileSize);
    uploadId = sessionId;

    // Upload chunks sequentially
    for (let i = 0; i < totalChunks; i++) {
      const startByte = i * CHUNK_SIZE;
      const endByte = Math.min((i + 1) * CHUNK_SIZE, fileSize);

      console.log(
        `[ChunkedUpload] Reading chunk ${i + 1}/${totalChunks} (bytes ${startByte}-${endByte})`
      );

      const chunkBase64 = await readVideoChunk(videoUri, startByte, endByte);

      console.log(
        `[ChunkedUpload] Uploading chunk ${i + 1}/${totalChunks} (${(chunkBase64.length / 1024).toFixed(2)}KB base64)`
      );

      const progress = await uploadSingleChunk(sessionId, i, chunkBase64);

      onProgress?.(progress);
    }

    // Finalize upload
    console.log('[ChunkedUpload] All chunks uploaded, finalizing...');
    const videoUrl = await finalizeUpload(uploadId);

    console.log('[ChunkedUpload] Upload complete:', videoUrl);

    return {
      videoUrl,
      uploadId,
      fileSize,
      duration: 30, // Duration in seconds (can be passed as parameter)
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    console.error('[ChunkedUpload] Upload failed:', err.message);
    onError?.(err);

    // Try to cancel the upload session if it was initiated
    if (uploadId) {
      try {
        await cancelUpload(uploadId);
      } catch (cancelError) {
        console.error('[ChunkedUpload] Error cancelling upload:', cancelError);
      }
    }

    throw err;
  }
}

/**
 * Resume a partially uploaded video
 */
export async function resumeVideoUpload(
  uploadId: string,
  videoUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<ChunkedUploadResult> {
  try {
    const fileSize = await getVideoSize(videoUri);
    const totalChunks = Math.max(1, Math.ceil(fileSize / CHUNK_SIZE));

    // Check which chunks are already uploaded
    const progress = await checkUploadProgress(uploadId);

    console.log(
      `[ChunkedUpload] Resuming upload ${uploadId}: ${progress.chunksUploaded}/${progress.totalChunks} chunks already uploaded`
    );

    // Upload remaining chunks
    for (let i = progress.chunksUploaded; i < totalChunks; i++) {
      const startByte = i * CHUNK_SIZE;
      const endByte = Math.min((i + 1) * CHUNK_SIZE, fileSize);

      const chunkBase64 = await readVideoChunk(videoUri, startByte, endByte);
      const uploadProgress = await uploadSingleChunk(uploadId, i, chunkBase64);

      onProgress?.(uploadProgress);
    }

    // Finalize upload
    const videoUrl = await finalizeUpload(uploadId);

    return {
      videoUrl,
      uploadId,
      fileSize,
      duration: 30,
    };
  } catch (error) {
    console.error('[ChunkedUpload] Error resuming upload:', error);
    throw error;
  }
}
