/**
 * Video Editor Utilities
 * Provides trimming, speed adjustment, and metadata management
 * Note: Actual video processing requires FFmpeg on native side
 */

export interface VideoEditSettings {
  startTime?: number; // in seconds
  endTime?: number; // in seconds
  speed?: number; // 0.5x, 1x, 1.5x, 2x
  quality?: 'low' | 'medium' | 'high'; // bitrate settings
}

export interface EditedVideoResult {
  uri: string;
  originalUri: string;
  duration: number;
  settings: VideoEditSettings;
  trimmedDuration: number;
}

/**
 * Common speed presets for video playback/export
 */
export const SPEED_PRESETS = {
  slowMo: 0.5,
  slow: 0.75,
  normal: 1.0,
  fast: 1.5,
  veryFast: 2.0,
} as const;

/**
 * Quality presets with corresponding bitrates (for compression)
 */
export const QUALITY_PRESETS = {
  low: {
    bitrate: '3m', // 3 Mbps - very small, high compression
    label: 'Low (Faster Upload)',
  },
  medium: {
    bitrate: '5m', // 5 Mbps - balanced
    label: 'Medium (Balanced)',
  },
  high: {
    bitrate: '8m', // 8 Mbps - higher quality
    label: 'High (Better Quality)',
  },
} as const;

/**
 * Calculate trimmed duration
 */
export function calculateTrimmedDuration(
  originalDuration: number,
  startTime: number = 0,
  endTime?: number
): number {
  const end = endTime || originalDuration;
  return Math.max(0, end - startTime);
}

/**
 * Validate trim settings
 */
export function validateTrimSettings(
  startTime: number,
  endTime: number,
  originalDuration: number
): { isValid: boolean; reason?: string } {
  if (startTime < 0 || endTime > originalDuration) {
    return {
      isValid: false,
      reason: 'Trim times must be within video duration',
    };
  }

  if (startTime >= endTime) {
    return {
      isValid: false,
      reason: 'Start time must be before end time',
    };
  }

  const trimmedDuration = calculateTrimmedDuration(originalDuration, startTime, endTime);
  if (trimmedDuration < 1) {
    return {
      isValid: false,
      reason: 'Trimmed video must be at least 1 second',
    };
  }

  return { isValid: true };
}

/**
 * Validate speed setting
 */
export function validateSpeed(speed: number): { isValid: boolean; reason?: string } {
  if (speed < 0.25 || speed > 4.0) {
    return {
      isValid: false,
      reason: 'Speed must be between 0.25x and 4x',
    };
  }
  return { isValid: true };
}

/**
 * Format time for display in trim UI
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  return `${secs}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Get quality label for display
 */
export function getQualityLabel(quality: 'low' | 'medium' | 'high'): string {
  return QUALITY_PRESETS[quality].label;
}

/**
 * Create edit summary for user display
 */
export function getEditSummary(settings: VideoEditSettings, originalDuration: number): string {
  const lines: string[] = [];

  if (settings.startTime !== undefined || settings.endTime !== undefined) {
    const start = settings.startTime || 0;
    const end = settings.endTime || originalDuration;
    lines.push(`Trim: ${formatTime(start)} - ${formatTime(end)}`);
  }

  if (settings.speed && settings.speed !== 1.0) {
    lines.push(`Speed: ${settings.speed}x`);
  }

  if (settings.quality && settings.quality !== 'medium') {
    lines.push(`Quality: ${getQualityLabel(settings.quality)}`);
  }

  return lines.length > 0 ? lines.join('\n') : 'No edits';
}

/**
 * Estimate file size after editing
 * Based on bitrate and trimmed duration
 */
export function estimateFileSize(
  originalSize: number,
  originalDuration: number,
  editedDuration: number,
  quality: 'low' | 'medium' | 'high' = 'medium'
): number {
  // Estimate based on bitrate
  // Formula: (bitrate in Mbps * duration in seconds) / 8 = size in MB
  const bitrates = {
    low: 3,
    medium: 5,
    high: 8,
  };

  const bitrate = bitrates[quality];
  const estimatedSizeBytes = (bitrate * 1024 * 1024 * editedDuration) / 8;

  return Math.round(estimatedSizeBytes);
}

/**
 * Format file size comparison
 */
export function formatSizeComparison(original: number, edited: number): string {
  const originalMB = (original / (1024 * 1024)).toFixed(2);
  const editedMB = (edited / (1024 * 1024)).toFixed(2);
  const savedMB = ((original - edited) / (1024 * 1024)).toFixed(2);
  const savedPercent = Math.round(((original - edited) / original) * 100);

  return `Original: ${originalMB}MB\nEdited: ${editedMB}MB\nSaved: ${savedMB}MB (${savedPercent}%)`;
}

/**
 * Default edit settings (no editing)
 */
export function getDefaultEditSettings(): VideoEditSettings {
  return {
    speed: 1.0,
    quality: 'medium',
  };
}

/**
 * Check if any edits have been made
 */
export function hasEdits(settings: VideoEditSettings, originalDuration: number): boolean {
  const defaults = getDefaultEditSettings();

  const hasTrim = settings.startTime !== undefined || settings.endTime !== undefined;
  const hasSpeedChange = settings.speed !== undefined && settings.speed !== defaults.speed;
  const hasQualityChange = settings.quality !== undefined && settings.quality !== defaults.quality;

  return hasTrim || hasSpeedChange || hasQualityChange;
}

/**
 * Merge edit settings with defaults
 */
export function mergeEditSettings(
  custom: Partial<VideoEditSettings>,
  defaults = getDefaultEditSettings()
): VideoEditSettings {
  return {
    ...defaults,
    ...custom,
  };
}

/**
 * Create FFmpeg command for video processing (future reference)
 * This would be used if implementing native FFmpeg support
 */
export function buildFFmpegCommand(
  inputUri: string,
  outputUri: string,
  settings: VideoEditSettings,
  originalDuration: number
): string[] {
  const cmd: string[] = ['-i', inputUri];

  // Add trim filter if specified
  if (settings.startTime !== undefined || settings.endTime !== undefined) {
    const start = settings.startTime || 0;
    const end = settings.endTime || originalDuration;
    const duration = end - start;
    cmd.push('-ss', String(start), '-t', String(duration));
  }

  // Add speed filter if specified
  if (settings.speed && settings.speed !== 1.0) {
    cmd.push('-filter:v', `setpts=${1 / settings.speed}*PTS`);
    cmd.push('-filter:a', `atempo=${settings.speed}`);
  }

  // Add bitrate based on quality
  if (settings.quality) {
    const bitrate = QUALITY_PRESETS[settings.quality].bitrate;
    cmd.push('-b:v', bitrate);
  }

  cmd.push('-y', outputUri);
  return cmd;
}
