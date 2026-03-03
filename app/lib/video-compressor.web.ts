/**
 * Video Compression Utility - Web Version
 * Uses FFmpeg.wasm for actual compression on web platform
 * Native version (video-compressor.ts) uses compression simulation
 */

export interface CompressionOptions {
  quality?: 'low' | 'medium' | 'high';
}

export interface CompressionResult {
  uri: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  duration: number;
  compressed: boolean;
}

let FFmpeg: any = null;
let FFmpegModule: any = null;

/**
 * Initialize FFmpeg.wasm (web only)
 */
async function initializeFFmpeg(): Promise<boolean> {
  if (FFmpeg) return true;

  try {
    // Import FFmpeg.wasm
    FFmpegModule = await import('@ffmpeg/ffmpeg');
    const { FFmpeg: FFmpegClass, toBlobURL } = FFmpegModule;

    FFmpeg = new FFmpegClass();
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.4/dist';

    FFmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    await FFmpeg.isLoaded();
    return true;
  } catch (error) {
    console.warn('[VideoCompressor] FFmpeg.wasm initialization failed:', error);
    FFmpeg = null;
    return false;
  }
}

/**
 * Get video file size in bytes
 */
export async function getVideoFileSize(uri: string): Promise<number> {
  try {
    // For http/https - do a HEAD request
    const response = await fetch(uri, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  } catch (error) {
    console.error('[VideoCompressor] Error getting file size:', error);
    return 0;
  }
}

/**
 * Compress video using FFmpeg.wasm on web
 */
export async function compressVideo(
  videoUri: string,
  options?: CompressionOptions
): Promise<CompressionResult> {
  try {
    const originalSize = await getVideoFileSize(videoUri);
    const quality = options?.quality || 'medium';

    console.log('[VideoCompressor] Starting FFmpeg compression:', {
      uri: videoUri,
      sizeMB: (originalSize / 1024 / 1024).toFixed(2),
      quality,
    });

    // Initialize FFmpeg
    const ffmpegAvailable = await initializeFFmpeg();

    if (!ffmpegAvailable || !FFmpeg) {
      throw new Error('FFmpeg.wasm not available');
    }

    try {
      // Fetch video file
      const response = await fetch(videoUri);
      const buffer = await response.arrayBuffer();
      const videoData = new Uint8Array(buffer);

      // Settings by quality
      const settings = {
        low: { bitrate: '500k', scale: '480:854' }, // 9:16 aspect
        medium: { bitrate: '1300k', scale: '720:1280' },
        high: { bitrate: '2500k', scale: '1080:1920' },
      };

      const config = settings[quality];

      // Write input file to FFmpeg
      FFmpeg.FS('writeFile', 'input.mp4', videoData);

      // Run compression
      console.log('[VideoCompressor] Running FFmpeg compression...');
      await FFmpeg.run(
        '-i',
        'input.mp4',
        '-b:v',
        config.bitrate,
        '-vf',
        `scale=${config.scale}`,
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-y',
        'output.mp4'
      );

      // Read result
      const compressedData = FFmpeg.FS('readFile', 'output.mp4');

      // Cleanup
      FFmpeg.FS('unlink', 'input.mp4');
      FFmpeg.FS('unlink', 'output.mp4');

      const compressedSize = compressedData.length;
      const compressedBase64 = btoa(String.fromCharCode(...compressedData));

      console.log('[VideoCompressor] Compression complete:', {
        original: (originalSize / 1024 / 1024).toFixed(2) + ' MB',
        compressed: (compressedSize / 1024 / 1024).toFixed(2) + ' MB',
        saved: ((1 - compressedSize / originalSize) * 100).toFixed(1) + '%',
      });

      return {
        uri: `data:video/mp4;base64,${compressedBase64}`,
        originalSize,
        compressedSize,
        compressionRatio: (compressedSize / originalSize) * 100,
        duration: 30,
        compressed: true,
      };
    } catch (error) {
      console.error('[VideoCompressor] FFmpeg compression error:', error);
      throw error;
    }
  } catch (error) {
    console.error('[VideoCompressor] Error:', error);
    // Return original as fallback
    const size = await getVideoFileSize(videoUri);
    return {
      uri: videoUri,
      originalSize: size,
      compressedSize: size,
      compressionRatio: 100,
      duration: 30,
      compressed: false,
    };
  }
}

/**
 * Compress video with progress callback
 */
export async function compressVideoWithProgress(
  videoUri: string,
  onProgress?: (progress: number) => void,
  options?: CompressionOptions
): Promise<CompressionResult> {
  try {
    onProgress?.(50);
    const result = await compressVideo(videoUri, options);
    onProgress?.(100);

    return result;
  } catch (error) {
    console.error('[VideoCompressor] Error during video preparation:', error);
    throw error;
  }
}

/**
 * Check if video needs compression (>50MB)
 */
export async function shouldCompress(
  videoUri: string,
  threshold: number = 50 * 1024 * 1024
): Promise<boolean> {
  const size = await getVideoFileSize(videoUri);
  return size > threshold;
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
