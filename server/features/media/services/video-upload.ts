import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/video-uploads';
const CHUNK_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

interface UploadSession {
  uploadId: string;
  fileName: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  createdAt: number;
  finalPath: string;
}

// In-memory store for upload sessions (can be replaced with database)
const uploadSessions = new Map<string, UploadSession>();

/**
 * Initialize a video upload session
 */
export function initializeUpload(
  fileName: string,
  totalChunks: number,
  fileSize: number
): {
  uploadId: string;
  chunkSize: number;
} {
  const uploadId = crypto.randomBytes(16).toString('hex');
  const finalPath = path.join(UPLOAD_DIR, `${uploadId}_${fileName}`);

  // Ensure upload directory exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  uploadSessions.set(uploadId, {
    uploadId,
    fileName,
    totalChunks,
    receivedChunks: new Set(),
    createdAt: Date.now(),
    finalPath,
  });

  // Calculate chunk size (aim for ~5MB chunks)
  const chunkSize = Math.ceil(fileSize / totalChunks);

  console.log(
    `[VideoUpload] Initialized upload ${uploadId}: ${fileName} (${totalChunks} chunks, ~${(chunkSize / 1024 / 1024).toFixed(2)}MB each)`
  );

  return { uploadId, chunkSize };
}

/**
 * Upload a video chunk
 */
export function uploadChunk(uploadId: string, chunkIndex: number, chunkData: Buffer): boolean {
  const session = uploadSessions.get(uploadId);
  if (!session) {
    throw new Error('Upload session not found');
  }

  const chunkPath = path.join(UPLOAD_DIR, `${uploadId}_chunk_${chunkIndex}`);

  try {
    fs.writeFileSync(chunkPath, chunkData);
    session.receivedChunks.add(chunkIndex);

    console.log(
      `[VideoUpload] Received chunk ${chunkIndex + 1}/${session.totalChunks} for ${uploadId}`
    );

    return true;
  } catch (error) {
    console.error(`[VideoUpload] Error writing chunk ${chunkIndex}:`, error);
    throw error;
  }
}

/**
 * Check upload progress
 */
export function getUploadProgress(uploadId: string): {
  uploadId: string;
  receivedChunks: number;
  totalChunks: number;
  progress: number;
  isComplete: boolean;
} {
  const session = uploadSessions.get(uploadId);
  if (!session) {
    throw new Error('Upload session not found');
  }

  const isComplete = session.receivedChunks.size === session.totalChunks;

  return {
    uploadId,
    receivedChunks: session.receivedChunks.size,
    totalChunks: session.totalChunks,
    progress: Math.round((session.receivedChunks.size / session.totalChunks) * 100),
    isComplete,
  };
}

/**
 * Finalize upload by merging all chunks (async with streams)
 */
export async function finalizeUpload(uploadId: string): Promise<string> {
  const session = uploadSessions.get(uploadId);
  if (!session) {
    throw new Error('Upload session not found');
  }

  if (session.receivedChunks.size !== session.totalChunks) {
    throw new Error(
      `Missing chunks: received ${session.receivedChunks.size}/${session.totalChunks}`
    );
  }

  try {
    // Create a write stream for the final file
    const writeStream = fs.createWriteStream(session.finalPath);

    // Write chunks in order using async streams
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(UPLOAD_DIR, `${uploadId}_chunk_${i}`);
      
      // Use stream pipeline for efficient async copy (no blocking)
      const readStream = fs.createReadStream(chunkPath);
      await new Promise<void>((resolve, reject) => {
        readStream.on('data', (chunk) => writeStream.write(chunk));
        readStream.on('end', () => resolve());
        readStream.on('error', reject);
      });
      
      // Clean up chunk file asynchronously
      await fsPromises.unlink(chunkPath).catch((err) =>
        console.warn(`[VideoUpload] Failed to delete chunk ${i}:`, err)
      );
    }

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        uploadSessions.delete(uploadId);
        console.log(`[VideoUpload] Finalized upload ${uploadId}: ${session.finalPath}`);
        // Return relative path for storage
        const relativePath = path.relative(UPLOAD_DIR, session.finalPath);
        resolve(`/videos/${relativePath}`);
      });

      writeStream.on('error', (error) => {
        reject(error);
      });

      writeStream.end();
    });
  } catch (error) {
    console.error(`[VideoUpload] Error finalizing upload ${uploadId}:`, error);
    throw error;
  }
}

/**
 * Cancel upload and cleanup (async)
 */
export async function cancelUpload(uploadId: string): Promise<void> {
  const session = uploadSessions.get(uploadId);
  if (!session) {
    throw new Error('Upload session not found');
  }

  try {
    // Clean up all chunk files asynchronously
    const deletePromises = [];
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(UPLOAD_DIR, `${uploadId}_chunk_${i}`);
      deletePromises.push(
        fsPromises.unlink(chunkPath).catch((err) => {
          // Ignore if file doesn't exist
          if (err.code !== 'ENOENT') {
            console.warn(`[VideoUpload] Failed to delete chunk ${i}:`, err);
          }
        })
      );
    }
    
    await Promise.all(deletePromises);
    uploadSessions.delete(uploadId);
    console.log(`[VideoUpload] Cancelled upload ${uploadId}`);
  } catch (error) {
    console.error(`[VideoUpload] Error cancelling upload ${uploadId}:`, error);
  }
}

/**
 * Clean up expired upload sessions
 */
export async function cleanupExpiredUploads(): Promise<void> {
  const now = Date.now();
  const expiredUploads: string[] = [];

  uploadSessions.forEach((session, uploadId) => {
    if (now - session.createdAt > CHUNK_TIMEOUT) {
      expiredUploads.push(uploadId);
    }
  });

  // Cancel all expired uploads in parallel
  const cleanupPromises = expiredUploads.map(async (uploadId) => {
    try {
      await cancelUpload(uploadId);
    } catch (error) {
      console.error(`[VideoUpload] Error cleaning up ${uploadId}:`, error);
    }
  });

  await Promise.all(cleanupPromises);

  if (expiredUploads.length > 0) {
    console.log(`[VideoUpload] Cleaned up ${expiredUploads.length} expired uploads`);
  }
}

// Run cleanup every hour
setInterval(() => {
  cleanupExpiredUploads().catch((err) => 
    console.error('[VideoUpload] Cleanup error:', err)
  );
}, 60 * 60 * 1000);
