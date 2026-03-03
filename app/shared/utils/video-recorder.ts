import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

export interface VideoRecordingResult {
  uri: string;
  duration: number;
  size: number;
  mimeType: string;
}

export interface RecorderStatus {
  isRecording: boolean;
  duration: number;
  metering: number;
}

/**
 * Initialize audio for video recording
 * Required before starting camera recording
 */
export async function initializeAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.error('Error initializing audio mode:', error);
    throw new Error('Failed to initialize audio');
  }
}

/**
 * Get video file size in bytes
 */
export async function getVideoFileSize(uri: string): Promise<number> {
  try {
    console.log('[VideoRecorder] Getting file size for:', uri);
    const fileInfo = await FileSystem.getInfoAsync(uri);
    console.log('[VideoRecorder] File info:', JSON.stringify(fileInfo));

    // Check if file exists
    if (!(fileInfo as any).exists) {
      console.error('[VideoRecorder] File does not exist at URI');
      return 0;
    }

    const size = (fileInfo as any).size || 0;
    console.log('[VideoRecorder] File size:', size, 'bytes');
    return size;
  } catch (error) {
    console.error('[VideoRecorder] Error getting video file size:', error);
    return 0;
  }
}

/**
 * Get video duration using expo-video-thumbnails or expo-av
 */
export async function getVideoDuration(_uri: string): Promise<number> {
  // Video.createAsync API was removed in expo-av SDK 54+.
  // Duration detection is not available without a mounted Video component.
  return 0;
}

/**
 * Delete a recorded video file
 */
export async function deleteVideoFile(uri: string): Promise<void> {
  try {
    // Only delete if it's a temporary file we created
    if (uri.includes('Documents') || uri.includes('tmp')) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (error) {
    console.error('Error deleting video file:', error);
  }
}

/**
 * Copy video file to app documents directory
 */
export async function copyVideoToStorage(sourceUri: string): Promise<string> {
  try {
    const filename = `video_${Date.now()}.mp4`;
    const fileSystem = FileSystem as any;
    const destinationUri = `${fileSystem.documentDirectory || fileSystem.cacheDirectory}${filename}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    return destinationUri;
  } catch (error) {
    console.error('Error copying video:', error);
    throw new Error('Failed to save video');
  }
}

/**
 * Format recording duration for display (MM:SS)
 */
export function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if video duration exceeds maximum allowed
 * Note: Returns true if duration is 0 (metadata unavailable)
 */
export function isVideoDurationValid(duration: number, maxDuration: number = 35): boolean {
  // If duration is 0, metadata is unavailable - allow video
  if (duration === 0) return true;
  return duration <= maxDuration;
}

/**
 * Get recording time remaining
 */
export function getRecordingTimeRemaining(elapsed: number, maxDuration: number = 35): number {
  return Math.max(0, maxDuration - elapsed);
}

/**
 * Validate recorded video
 */
export async function validateRecordedVideo(
  uri: string,
  maxDuration: number = 35
): Promise<{
  isValid: boolean;
  duration: number;
  size: number;
  reason?: string;
}> {
  try {
    const duration = await getVideoDuration(uri);
    const size = await getVideoFileSize(uri);

    // Check file size first (most reliable)
    if (size === 0) {
      return {
        isValid: false,
        duration,
        size,
        reason: 'Video file is empty or could not be accessed',
      };
    }

    // Check duration if available (0 means metadata unavailable)
    const durationValid = isVideoDurationValid(duration, maxDuration);
    if (!durationValid && duration > 0) {
      return {
        isValid: false,
        duration,
        size,
        reason: `Video duration (${Math.round(duration)}s) exceeds limit of ${maxDuration} seconds`,
      };
    }

    return {
      isValid: true,
      duration,
      size,
    };
  } catch (error) {
    return {
      isValid: false,
      duration: 0,
      size: 0,
      reason: 'Failed to validate video',
    };
  }
}

/**
 * Create a recording summary
 */
export function getRecordingSummary(result: VideoRecordingResult): string {
  const sizeInMB = (result.size / (1024 * 1024)).toFixed(2);
  const mins = Math.floor(result.duration / 60);
  const secs = result.duration % 60;
  const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  return `Duration: ${durationStr}\nFile Size: ${sizeInMB} MB`;
}

/**
 * Check if recording can continue based on storage
 */
export async function checkStorageAvailable(requiredMB: number = 100): Promise<boolean> {
  try {
    const info = await FileSystem.getFreeDiskStorageAsync();
    const freeMB = info / (1024 * 1024);
    return freeMB > requiredMB;
  } catch (error) {
    console.error('Error checking storage:', error);
    return true; // Assume storage is available if we can't check
  }
}
