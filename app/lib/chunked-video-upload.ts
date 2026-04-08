/**
 * Chunked Video Upload Utility
 * Handles splitting videos into chunks and uploading them to the server
 * with progress tracking and resume capability
 */

import * as FileSystem from 'expo-file-system/legacy';
import { getApiUrl } from '@/lib/query-client';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks

function getUploadApiUrl(path: string): string {
  const baseUrl = getApiUrl();
  return `${baseUrl}${path}`;
}

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

type ServerUploadProgress = Partial<UploadProgress> & {
  receivedChunks?: number;
};

function normalizeUploadProgress(raw: ServerUploadProgress): UploadProgress {
  const chunksUploaded =
    typeof raw.chunksUploaded === 'number'
      ? raw.chunksUploaded
      : typeof raw.receivedChunks === 'number'
        ? raw.receivedChunks
        : 0;
  const totalChunks = typeof raw.totalChunks === 'number' ? raw.totalChunks : 0;

  return {
    uploadId: String(raw.uploadId || ''),
    chunksUploaded,
    totalChunks,
    progress:
      typeof raw.progress === 'number'
        ? raw.progress
        : totalChunks > 0
          ? Math.round((chunksUploaded / totalChunks) * 100)
          : 0,
    isComplete:
      typeof raw.isComplete === 'boolean'
        ? raw.isComplete
        : totalChunks > 0 && chunksUploaded >= totalChunks,
  };
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
  endByte: number,
  fileSize: number
): Promise<string> {
  try {
    if (startByte >= fileSize) {
      throw new Error('Start byte exceeds file size');
    }

    const actualEndByte = Math.min(endByte, fileSize);
    const chunkLength = actualEndByte - startByte;

    // Expo supports reading base64 slices directly using position+length.
    return await FileSystem.readAsStringAsync(videoUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: startByte,
      length: chunkLength,
    });
  } catch (error) {
    console.error('[ChunkedUpload] Error reading video chunk:', error);
    throw error;
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const maybeBuffer = (globalThis as unknown as {
    Buffer?: { from: (value: string, encoding: string) => Uint8Array };
  }).Buffer;

  if (maybeBuffer) {
    return new Uint8Array(maybeBuffer.from(base64, 'base64'));
  }

  throw new Error('No base64 decoder available in this environment');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
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
    const response = await fetch(getUploadApiUrl('/api/videos/initiate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        totalChunks,
        fileSize,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let parsedError: { error?: string; retryAfter?: string; code?: string } | null = null;
      try {
        parsedError = JSON.parse(errorBody) as {
          error?: string;
          retryAfter?: string;
          code?: string;
        };
      } catch {
        parsedError = null;
      }

      const error = new Error(`HTTP ${response.status} ${errorBody}`);
      if (response.status === 429) {
        (error as Error & { code?: string }).code = parsedError?.code || 'RATE_LIMIT_EXCEEDED';
      }
      if (parsedError?.retryAfter) {
        (error as Error & { retryAfter?: string }).retryAfter = parsedError.retryAfter;
      }
      throw error;
    }

    const data = await response.json();
    console.log('[ChunkedUpload] Upload initiated:', data.uploadId);
    return data;
  } catch (error) {
    console.error('[ChunkedUpload] Error initiating upload:', error);
    throw error instanceof Error ? error : new Error('Failed to initiate upload');
  }
}

/**
 * Upload a single chunk to the server
 */
async function uploadSingleChunkBinary(
  uploadId: string,
  chunkIndex: number,
  chunkBytes: Uint8Array
): Promise<UploadProgress> {
  const params = new URLSearchParams({
    uploadId,
    chunkIndex: String(chunkIndex),
  });

  const response = await fetch(getUploadApiUrl(`/api/videos/upload-chunk?${params.toString()}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: toArrayBuffer(chunkBytes),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    success?: boolean;
    message?: string;
    progress?: ServerUploadProgress;
  };
  if (!data.success || !data.progress) {
    throw new Error(data.message || 'Binary chunk upload failed');
  }

  return normalizeUploadProgress(data.progress);
}

async function uploadSingleChunkJson(
  uploadId: string,
  chunkIndex: number,
  chunkBase64: string
): Promise<UploadProgress> {
  const response = await fetch(getUploadApiUrl('/api/videos/upload-chunk'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      chunkIndex,
      chunkData: chunkBase64,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    success?: boolean;
    message?: string;
    progress?: ServerUploadProgress;
  };
  if (!data.success || !data.progress) {
    throw new Error(data.message || 'Upload failed');
  }

  return normalizeUploadProgress(data.progress);
}

async function uploadSingleChunk(
  uploadId: string,
  chunkIndex: number,
  chunkBase64: string
): Promise<UploadProgress> {
  try {
    const chunkBytes = base64ToUint8Array(chunkBase64);
    const progress = await uploadSingleChunkBinary(uploadId, chunkIndex, chunkBytes);
    console.log(
      `[ChunkedUpload] Chunk ${chunkIndex + 1} uploaded (binary), progress: ${progress.progress}%`
    );
    return progress;
  } catch (binaryError) {
    console.warn(
      `[ChunkedUpload] Binary upload failed for chunk ${chunkIndex + 1}; falling back to JSON`,
      binaryError
    );
    const progress = await uploadSingleChunkJson(uploadId, chunkIndex, chunkBase64);
    console.log(
      `[ChunkedUpload] Chunk ${chunkIndex + 1} uploaded (json fallback), progress: ${progress.progress}%`
    );
    return progress;
  }
}

/**
 * Check upload progress on server
 */
export async function checkUploadProgress(uploadId: string): Promise<UploadProgress> {
  try {
    const response = await fetch(getUploadApiUrl(`/api/videos/progress/${uploadId}`));

    if (!response.ok) {
      throw new Error('Upload session not found');
    }

    const data = (await response.json()) as ServerUploadProgress;
    return normalizeUploadProgress(data);
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
    const response = await fetch(getUploadApiUrl('/api/videos/finalize'), {
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
    const response = await fetch(getUploadApiUrl('/api/videos/cancel'), {
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

      const chunkBase64 = await readVideoChunk(videoUri, startByte, endByte, fileSize);

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

      const chunkBase64 = await readVideoChunk(videoUri, startByte, endByte, fileSize);
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
