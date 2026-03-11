export * from '../utils/chunked-video-upload';
export * from '../utils/colors';
export * from '../utils/config';
export * from '../utils/image-compressor';
export * from '../utils/image-hasher';
export * from '../utils/image-storage';
export * from '../utils/invoice-storage';
export * from '../utils/location-data';
export * from '../utils/personalization';
export * from '../utils/query-client';
export * from '../utils/sample-data';
export * from '../utils/types';
export * from '../utils/use-admin-settings';
export * from '../utils/use-payment';
export * from '../utils/utils';

// Re-export video editor helpers with explicit names to avoid conflicts
// with image/video compressor preset names.
export {
  calculateTrimmedDuration,
  validateTrimSettings,
  validateSpeed,
  formatTime,
  getQualityLabel,
  getEditSummary,
  estimateFileSize,
  formatSizeComparison,
  getDefaultEditSettings,
  hasEdits,
  mergeEditSettings,
  buildFFmpegCommand,
  SPEED_PRESETS,
} from '../utils/video-editor';
export type { VideoEditSettings, EditedVideoResult } from '../utils/video-editor';
export { QUALITY_PRESETS as VIDEO_EDIT_QUALITY_PRESETS } from '../utils/video-editor';

// Re-export video recorder helpers with explicit aliases for overlapping symbols.
export {
  initializeAudioMode,
  getVideoDuration,
  deleteVideoFile,
  copyVideoToStorage,
  formatRecordingTime,
  isVideoDurationValid,
  getRecordingTimeRemaining,
  validateRecordedVideo,
  getRecordingSummary,
  checkStorageAvailable,
} from '../utils/video-recorder';
export type { VideoRecordingResult, RecorderStatus } from '../utils/video-recorder';
export { getVideoFileSize as getRecordedVideoFileSize } from '../utils/video-recorder';

// Re-export video helpers with explicit names to avoid symbol collisions
// with image-compressor exports (e.g., CompressionOptions, formatBytes).
export {
  compressVideo,
  compressVideoWithProgress,
  getVideoFileSize,
  shouldCompress,
  analyzeVideo,
  VIDEO_RECORDING_PRESETS,
} from '../utils/video-compressor';
export type {
  CompressionResult,
  CompressionOptions as VideoCompressionOptions,
} from '../utils/video-compressor';
export {
  formatBytes as formatVideoBytes,
  getCompressionSummary as getVideoCompressionSummary,
} from '../utils/video-compressor';
