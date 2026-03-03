/**
 * Video Compression Service (Server-Side)
 * Uses FFmpeg to compress videos after upload for better efficiency
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface VideoCompressionOptions {
  quality?: 'low' | 'medium' | 'high';
  maxWidth?: number;
  maxHeight?: number;
}

export interface CompressionResult {
  originalPath: string;
  compressedPath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  success: boolean;
}

/**
 * Compression profiles
 */
const COMPRESSION_PROFILES = {
  low: {
    videoBitrate: '500k',
    audioBitrate: '96k',
    resolution: '480:854',
    description: 'Low quality (very small file)',
  },
  medium: {
    videoBitrate: '1200k',
    audioBitrate: '128k',
    resolution: '720:1280',
    description: 'Medium quality (balanced)',
  },
  high: {
    videoBitrate: '2500k',
    audioBitrate: '192k',
    resolution: '1080:1920',
    description: 'High quality (larger file)',
  },
};

/**
 * Check if FFmpeg is installed
 */
export function isFFmpegAvailable(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compress video using FFmpeg
 * @param inputPath Path to original video
 * @param outputPath Path for compressed video file
 * @param options Compression options
 */
export function compressVideoSync(
  inputPath: string,
  outputPath: string,
  options: VideoCompressionOptions = { quality: 'medium' }
): CompressionResult {
  const quality = options.quality || 'medium';
  const profile = COMPRESSION_PROFILES[quality];

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input video not found: ${inputPath}`);
  }

  // Get original file size
  const originalSize = fs.statSync(inputPath).size;
  console.log(`[VideoCompression] Compressing ${path.basename(inputPath)}`);
  console.log(`  Quality: ${quality} (${profile.description})`);
  console.log(`  Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

  try {
    // FFmpeg command for compression
    // Using VP9/H.264 codec for better compression
    const command = [
      '-i', inputPath,
      '-c:v', 'libx264',  // H.264 codec (better compatibility than VP9)
      '-preset', 'medium', // medium speed/quality tradeoff
      '-b:v', profile.videoBitrate,
      '-maxrate', profile.videoBitrate,
      '-bufsize', `${parseInt(profile.videoBitrate) * 2}k`,
      '-vf', `scale=${profile.resolution}:force_original_aspect_ratio=decrease,pad=${profile.resolution}:0:0:color=black`,
      '-c:a', 'aac',
      '-b:a', profile.audioBitrate,
      '-movflags', '+faststart', // Allow streaming from the start
      '-y', // Overwrite output file
      outputPath,
    ].join(' ');

    console.log(`[VideoCompression] Running: ffmpeg ${command.substring(0, 100)}...`);
    
    execSync(`ffmpeg ${command}`, {
      stdio: ['pipe', 'pipe', 'pipe'], // Suppress FFmpeg output
      encoding: 'utf-8',
    });

    // Get compressed file size
    const compressedSize = fs.statSync(outputPath).size;
    const compressionRatio = (compressedSize / originalSize) * 100;

    console.log(`[VideoCompression] Success!`);
    console.log(`  Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Compression ratio: ${compressionRatio.toFixed(1)}%`);
    console.log(`  Space saved: ${((1 - compressedSize / originalSize) * 100).toFixed(1)}%`);

    return {
      originalPath: inputPath,
      compressedPath: outputPath,
      originalSize,
      compressedSize,
      compressionRatio,
      success: true,
    };
  } catch (error) {
    console.error(`[VideoCompression] Error compressing video:`, error);
    
    // If compression fails, return original
    if (!fs.existsSync(outputPath)) {
      fs.copyFileSync(inputPath, outputPath);
    }

    const compressedSize = fs.statSync(outputPath).size;
    return {
      originalPath: inputPath,
      compressedPath: outputPath,
      originalSize,
      compressedSize,
      compressionRatio: 100,
      success: false,
    };
  }
}

/**
 * Compress video asynchronously (non-blocking)
 */
export async function compressVideoAsync(
  inputPath: string,
  outputPath: string,
  options: VideoCompressionOptions = { quality: 'medium' }
): Promise<CompressionResult> {
  return new Promise((resolve) => {
    try {
      const result = compressVideoSync(inputPath, outputPath, options);
      resolve(result);
    } catch (error) {
      console.error('[VideoCompression] Async error:', error);
      resolve({
        originalPath: inputPath,
        compressedPath: outputPath,
        originalSize: 0,
        compressedSize: 0,
        compressionRatio: 0,
        success: false,
      });
    }
  });
}

/**
 * Get compression statistics for multiple quality levels
 */
export function getCompressionStats(inputPath: string): Record<string, any> {
  const originalSize = fs.statSync(inputPath).size;

  return {
    originalFile: path.basename(inputPath),
    originalSize: `${(originalSize / 1024 / 1024).toFixed(2)} MB`,
    estimates: {
      low: {
        ...COMPRESSION_PROFILES.low,
        estimatedSize: `${((originalSize * 0.25) / 1024 / 1024).toFixed(2)} MB`,
        estimatedSavings: '75%',
      },
      medium: {
        ...COMPRESSION_PROFILES.medium,
        estimatedSize: `${((originalSize * 0.50) / 1024 / 1024).toFixed(2)} MB`,
        estimatedSavings: '50%',
      },
      high: {
        ...COMPRESSION_PROFILES.high,
        estimatedSize: `${((originalSize * 0.75) / 1024 / 1024).toFixed(2)} MB`,
        estimatedSavings: '25%',
      },
    },
  };
}
