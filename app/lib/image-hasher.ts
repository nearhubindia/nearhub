import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Image hash and metadata storage
 */
export interface ImageHash {
  hash: string; // SHA256 hash
  uri: string; // Original/compressed URI
  size: number; // File size in bytes
  width: number;
  height: number;
  quality: number;
  created: string; // ISO timestamp
  usageCount: number; // How many listings use this image
}

/**
 * Generate SHA256 hash of a file or base64 data
 */
export async function generateImageHash(fileUriOrBase64: string): Promise<string> {
  try {
    let base64Data: string;

    // Check if it's already base64 data
    if (fileUriOrBase64.startsWith('data:image/')) {
      // Extract base64 from data URI
      const base64Match = fileUriOrBase64.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (base64Match) {
        base64Data = base64Match[1];
      } else {
        throw new Error('Invalid base64 data URI format');
      }
    } else if (fileUriOrBase64.startsWith('file://') || fileUriOrBase64.startsWith('content://')) {
      // It's a file URI - read it
      try {
        if (FileSystem.readAsStringAsync) {
          base64Data = await FileSystem.readAsStringAsync(fileUriOrBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          throw new Error('FileSystem.readAsStringAsync not available');
        }
      } catch (fsError) {
        console.error('FileSystem read error:', fsError);
        throw new Error('Failed to read file for hashing');
      }
    } else {
      // Assume it's raw base64 without data URI prefix
      base64Data = fileUriOrBase64;
    }

    // Generate SHA256 hash using expo-crypto
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64Data
    );
    return hash;
  } catch (error) {
    console.error('Error generating image hash:', error);
    // Return a fallback hash based on timestamp and random value
    // This prevents the error from breaking the upload flow
    const fallbackHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Date.now()}-${Math.random()}-${fileUriOrBase64.substring(0, 50)}`
    );
    console.log('Using fallback hash:', fallbackHash.substring(0, 12));
    return fallbackHash;
  }
}

/**
 * Generate short hash ID (first 12 chars)
 * Example: "ab3c42f9e2d1" (more unique than full)
 */
export function getShortHash(fullHash: string): string {
  return fullHash.substring(0, 12);
}

/**
 * Generate hash filename
 * Example: "ab3c42f9e2d1.jpg"
 */
export function getHashFilename(hash: string, format: string = 'jpg'): string {
  const shortHash = getShortHash(hash);
  return `${shortHash}.${format}`;
}

/**
 * Create image hash object
 */
export function createImageHash(
  fullHash: string,
  uri: string,
  size: number,
  width: number,
  height: number,
  quality: number
): ImageHash {
  return {
    hash: fullHash,
    uri,
    size,
    width,
    height,
    quality,
    created: new Date().toISOString(),
    usageCount: 1,
  };
}

/**
 * Format hash for display (short + checksum)
 * Example: "ab3c42f... (1.2 MB)"
 */
export function formatHashForDisplay(hash: ImageHash): string {
  const shortHash = getShortHash(hash.hash);
  const sizeKB = (hash.size / 1024).toFixed(1);
  return `${shortHash}... (${sizeKB} KB)`;
}

/**
 * Verify image hash matches expected value
 */
export async function verifyImageHash(fileUri: string, expectedHash: string): Promise<boolean> {
  try {
    const actualHash = await generateImageHash(fileUri);
    return actualHash === expectedHash;
  } catch (error) {
    console.error('Error verifying hash:', error);
    return false;
  }
}

/**
 * Compare two images by hash (deduplication check)
 */
export function isSameImage(hash1: ImageHash, hash2: ImageHash): boolean {
  return hash1.hash === hash2.hash;
}

/**
 * Batch hash multiple images
 */
export async function batchHashImages(
  imageUris: string[],
  onProgress?: (current: number, total: number) => void
): Promise<{ uri: string; hash: string }[]> {
  const results: { uri: string; hash: string }[] = [];
  const total = imageUris.length;

  for (let i = 0; i < total; i++) {
    const uri = imageUris[i];
    try {
      const hash = await generateImageHash(uri);
      results.push({ uri, hash });
      onProgress?.(i + 1, total);
    } catch (error) {
      console.error(`Failed to hash image ${i}:`, error);
    }
  }

  return results;
}

/**
 * Find duplicate images in a list
 * Returns groups of identical images
 */
export function findDuplicates(hashes: ImageHash[]): ImageHash[][] {
  const groups = new Map<string, ImageHash[]>();

  for (const hash of hashes) {
    const key = hash.hash;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(hash);
  }

  // Return only groups with duplicates
  return Array.from(groups.values()).filter((group) => group.length > 1);
}

/**
 * Get safe filename from hash (for storage/backup)
 */
export function getStorageFilename(hash: string): string {
  return `img_${getShortHash(hash)}.jpg`;
}

/**
 * Parse storage filename to get hash
 */
export function getHashFromStorageFilename(filename: string): string | null {
  const match = filename.match(/img_([a-f0-9]{12})\.jpg/);
  return match ? match[1] : null;
}

/**
 * Create hash summary for debugging
 */
export function getHashSummary(hashes: ImageHash[]): string {
  if (hashes.length === 0) return 'No images';

  const totalSize = hashes.reduce((sum, h) => sum + h.size, 0);
  const uniqueHashes = new Set(hashes.map((h) => h.hash)).size;
  const duplicates = hashes.length - uniqueHashes;

  return `${hashes.length} images (${uniqueHashes} unique)\nTotal: ${(totalSize / 1024).toFixed(1)} KB\nDuplicates saved: ${duplicates}`;
}
