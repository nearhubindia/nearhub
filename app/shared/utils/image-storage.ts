import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ImageHash,
  generateImageHash,
  createImageHash,
  getShortHash,
  isSameImage,
} from './image-hasher';

/**
 * Hash-based image storage with deduplication
 * Stores image metadata by hash, prevents duplicates
 */

const HASH_STORAGE_KEY = '@adli:image_hashes';
const HASH_INDEX_KEY = '@adli:hash_index'; // For quick lookups

export interface ImageHashStorage {
  [hash: string]: ImageHash;
}

export interface HashIndex {
  [shortHash: string]: string; // shortHash -> fullHash mapping
}

/**
 * Initialize hash storage
 */
async function initializeStorage(): Promise<ImageHashStorage> {
  try {
    const stored = await AsyncStorage.getItem(HASH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error initializing hash storage:', error);
    return {};
  }
}

/**
 * Initialize hash index
 */
async function initializeIndex(): Promise<HashIndex> {
  try {
    const stored = await AsyncStorage.getItem(HASH_INDEX_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error initializing hash index:', error);
    return {};
  }
}

/**
 * Save image by hash (deduplication)
 * Returns the hash if new, or existing hash if duplicate found
 */
export async function saveImageByHash(
  fileUri: string,
  width: number,
  height: number,
  quality: number,
  size: number
): Promise<string> {
  try {
    // Generate hash
    const fullHash = await generateImageHash(fileUri);

    const storage = await initializeStorage();
    const index = await initializeIndex();

    // Check if already exists
    if (storage[fullHash]) {
      // Image already stored - increment usage
      storage[fullHash].usageCount++;
      await AsyncStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(storage));
      return fullHash;
    }

    // New image - store it
    const imageHash = createImageHash(fullHash, fileUri, size, width, height, quality);

    storage[fullHash] = imageHash;
    index[getShortHash(fullHash)] = fullHash;

    await AsyncStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(storage));
    await AsyncStorage.setItem(HASH_INDEX_KEY, JSON.stringify(index));

    return fullHash;
  } catch (error) {
    console.error('Error saving image by hash:', error);
    throw new Error('Failed to save image');
  }
}

/**
 * Get image by hash
 */
export async function getImageByHash(hash: string): Promise<ImageHash | null> {
  try {
    const storage = await initializeStorage();
    return storage[hash] || null;
  } catch (error) {
    console.error('Error getting image by hash:', error);
    return null;
  }
}

/**
 * Check if image exists (by hash)
 */
export async function imageExists(hash: string): Promise<boolean> {
  try {
    const storage = await initializeStorage();
    return !!storage[hash];
  } catch (error) {
    console.error('Error checking image existence:', error);
    return false;
  }
}

/**
 * Find duplicate by content
 * Returns the hash of an existing identical image, or null if unique
 */
export async function findDuplicateHash(fileUri: string): Promise<string | null> {
  try {
    const newHash = await generateImageHash(fileUri);
    const storage = await initializeStorage();

    // Check if hash already in storage
    if (storage[newHash]) {
      return newHash; // Found duplicate
    }

    return null; // Unique image
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return null;
  }
}

/**
 * Increment usage count for an image
 */
export async function incrementImageUsage(hash: string): Promise<void> {
  try {
    const storage = await initializeStorage();
    if (storage[hash]) {
      storage[hash].usageCount++;
      await AsyncStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(storage));
    }
  } catch (error) {
    console.error('Error incrementing usage:', error);
  }
}

/**
 * Decrement usage count and remove if no longer used
 */
export async function decrementImageUsage(hash: string): Promise<boolean> {
  try {
    const storage = await initializeStorage();
    const index = await initializeIndex();

    if (storage[hash]) {
      storage[hash].usageCount--;

      if (storage[hash].usageCount <= 0) {
        // Remove unused image
        delete storage[hash];
        delete index[getShortHash(hash)];
        await AsyncStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(storage));
        await AsyncStorage.setItem(HASH_INDEX_KEY, JSON.stringify(index));
        return true; // Image deleted
      } else {
        // Update with new count
        await AsyncStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(storage));
        return false; // Image still in use
      }
    }
  } catch (error) {
    console.error('Error decrementing usage:', error);
  }
  return false;
}

/**
 * Get all stored images
 */
export async function getAllStoredImages(): Promise<ImageHash[]> {
  try {
    const storage = await initializeStorage();
    return Object.values(storage);
  } catch (error) {
    console.error('Error getting all images:', error);
    return [];
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  totalImages: number;
  uniqueImages: number;
  totalSize: number;
  duplicatesSaved: number;
}> {
  try {
    const images = await getAllStoredImages();
    const totalImages = images.reduce((sum, img) => sum + img.usageCount, 0);
    const uniqueImages = images.length;
    const totalSize = images.reduce((sum, img) => sum + img.size, 0);
    const duplicatesSaved = Math.max(0, totalImages - uniqueImages);

    return {
      totalImages,
      uniqueImages,
      totalSize,
      duplicatesSaved,
    };
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return {
      totalImages: 0,
      uniqueImages: 0,
      totalSize: 0,
      duplicatesSaved: 0,
    };
  }
}

/**
 * Clear all hashes and reset storage
 */
export async function clearHashStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HASH_STORAGE_KEY);
    await AsyncStorage.removeItem(HASH_INDEX_KEY);
  } catch (error) {
    console.error('Error clearing hash storage:', error);
  }
}

/**
 * Export all hashes for backup
 */
export async function exportHashes(): Promise<ImageHashStorage> {
  try {
    return await initializeStorage();
  } catch (error) {
    console.error('Error exporting hashes:', error);
    return {};
  }
}

/**
 * Import hashes from backup
 */
export async function importHashes(hashes: ImageHashStorage): Promise<void> {
  try {
    const index: HashIndex = {};
    for (const hash in hashes) {
      index[getShortHash(hash)] = hash;
    }
    await AsyncStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(hashes));
    await AsyncStorage.setItem(HASH_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.error('Error importing hashes:', error);
    throw new Error('Failed to import hashes');
  }
}

/**
 * Consolidate storage by removing unused images
 */
export async function consolidateStorage(): Promise<{
  removed: number;
  saved: number;
}> {
  try {
    const storage = await initializeStorage();
    const index = await initializeIndex();
    let removedCount = 0;
    let savedBytes = 0;

    for (const hash in storage) {
      if (storage[hash].usageCount <= 0) {
        savedBytes += storage[hash].size;
        delete storage[hash];
        delete index[getShortHash(hash)];
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await AsyncStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(storage));
      await AsyncStorage.setItem(HASH_INDEX_KEY, JSON.stringify(index));
    }

    return { removed: removedCount, saved: savedBytes };
  } catch (error) {
    console.error('Error consolidating storage:', error);
    return { removed: 0, saved: 0 };
  }
}
