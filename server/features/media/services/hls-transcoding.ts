import crypto from 'node:crypto';
import fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import path from 'node:path';
import { runFfmpeg } from '../../../shared/media/ffmpeg';

const HLS_CACHE_ROOT = process.env.HLS_CACHE_DIR || '/tmp/video-hls-cache';
const transcodeInFlight = new Map<string, Promise<void>>();

function ensureDirSync(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isTranscodeReady(streamDir: string): boolean {
  return (
    fs.existsSync(path.join(streamDir, '360p.m3u8')) &&
    fs.existsSync(path.join(streamDir, '720p.m3u8')) &&
    fs.existsSync(path.join(streamDir, '1080p.m3u8'))
  );
}

async function transcodeVariant(
  sourceUrl: string,
  streamDir: string,
  variant: '360p' | '720p' | '1080p'
): Promise<void> {
  const is360 = variant === '360p';
  const is720 = variant === '720p';
  const height = is360 ? 360 : is720 ? 720 : 1080;
  const maxRate = is360 ? '900k' : is720 ? '2200k' : '4200k';
  const bufSize = is360 ? '1350k' : is720 ? '3300k' : '6300k';
  const audioRate = is360 ? '96k' : is720 ? '128k' : '160k';

  const playlistPath = path.join(streamDir, `${variant}.m3u8`);
  const segmentPattern = path.join(streamDir, `${variant}_%03d.ts`);

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    sourceUrl,
    '-vf',
    `scale=-2:${height}`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-profile:v',
    'main',
    '-level',
    '3.1',
    '-x264-params',
    'keyint=48:min-keyint=48:scenecut=0',
    '-g',
    '48',
    '-keyint_min',
    '48',
    '-c:a',
    'aac',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-b:a',
    audioRate,
    '-maxrate',
    maxRate,
    '-bufsize',
    bufSize,
    '-f',
    'hls',
    '-hls_time',
    '4',
    '-hls_playlist_type',
    'vod',
    '-hls_flags',
    'independent_segments',
    '-hls_segment_filename',
    segmentPattern,
    playlistPath,
  ];

  await runFfmpeg(args);
}

export function getStreamIdForSource(sourceUrl: string): string {
  return crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 20);
}

export function getStreamDir(streamId: string): string {
  return path.join(HLS_CACHE_ROOT, streamId);
}

export async function ensureHlsTranscoded(sourceUrl: string): Promise<{ streamId: string }> {
  ensureDirSync(HLS_CACHE_ROOT);

  const streamId = getStreamIdForSource(sourceUrl);
  const streamDir = getStreamDir(streamId);
  ensureDirSync(streamDir);

  if (isTranscodeReady(streamDir)) {
    return { streamId };
  }

  if (!transcodeInFlight.has(streamId)) {
    const task = (async () => {
      await transcodeVariant(sourceUrl, streamDir, '360p');
      await transcodeVariant(sourceUrl, streamDir, '720p');
      await transcodeVariant(sourceUrl, streamDir, '1080p');
    })();
    transcodeInFlight.set(streamId, task);
  }

  try {
    await transcodeInFlight.get(streamId);
  } finally {
    transcodeInFlight.delete(streamId);
  }

  return { streamId };
}

export function buildMasterManifest(baseUrl: string, streamId: string): string {
  const prefix = `${baseUrl}/api/videos/hls/${streamId}`;
  return [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360',
    `${prefix}/360p.m3u8`,
    '#EXT-X-STREAM-INF:BANDWIDTH=2200000,RESOLUTION=1280x720',
    `${prefix}/720p.m3u8`,
    '#EXT-X-STREAM-INF:BANDWIDTH=4200000,RESOLUTION=1920x1080',
    `${prefix}/1080p.m3u8`,
    '',
  ].join('\n');
}

export async function buildVariantManifest(
  baseUrl: string,
  streamId: string,
  variantFileName: string
): Promise<string> {
  const streamDir = getStreamDir(streamId);
  const variantPath = path.join(streamDir, variantFileName);
  const raw = await fsp.readFile(variantPath, 'utf8');
  const prefix = `${baseUrl}/api/videos/hls/${streamId}`;

  return raw
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      if (trimmed.endsWith('.ts')) return `${prefix}/${trimmed}`;
      return line;
    })
    .join('\n');
}
