import crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { SERVER_CONFIG } from '../../../lib/config';

export type MediaType = 'image' | 'video';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
]);

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
};

function getRequiredEnv(name: string, value: string): string {
  if (!value) {
    throw new Error(`Missing required Cloudflare R2 config: ${name}`);
  }
  return value;
}

function getR2Client(): S3Client {
  const accountId = getRequiredEnv(
    'CLOUDFLARE_R2_ACCOUNT_ID',
    SERVER_CONFIG.CLOUDFLARE_R2_ACCOUNT_ID
  );
  const accessKeyId = getRequiredEnv(
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    SERVER_CONFIG.CLOUDFLARE_R2_ACCESS_KEY_ID
  );
  const secretAccessKey = getRequiredEnv(
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    SERVER_CONFIG.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  );

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    requestHandler: new NodeHttpHandler({
      connectionTimeout:
        Number.parseInt(process.env.CLOUDFLARE_R2_CONNECTION_TIMEOUT_MS || '10000', 10) || 10000,
      requestTimeout:
        Number.parseInt(process.env.CLOUDFLARE_R2_REQUEST_TIMEOUT_MS || '180000', 10) || 180000,
    }),
  });
}

function sanitizePathPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function toDeterministicUuid(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const base = hash.slice(0, 32).split('');
  // RFC4122-ish format: set version (4) and variant (10xx)
  base[12] = '4';
  const variantNibble = parseInt(base[16] || '8', 16);
  base[16] = ((variantNibble & 0x3) | 0x8).toString(16);
  const hex = base.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20, 32)}`;
}

function toMediaOwnerKey(userId?: string): string {
  const raw = String(userId || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'anonymous';
  if (isUuid(raw)) return raw;
  return toDeterministicUuid(raw);
}

function normalizeContentType(value: string): string {
  return (value || '').toLowerCase().trim();
}

function isAllowedContentType(mediaType: MediaType, contentType: string): boolean {
  if (mediaType === 'image') {
    return ALLOWED_IMAGE_MIME_TYPES.has(contentType);
  }
  return ALLOWED_VIDEO_MIME_TYPES.has(contentType);
}

function resolveExtension(originalFileName: string, contentType: string): string {
  const byMime = MIME_EXTENSION_MAP[contentType];
  if (byMime) return byMime;

  const fileParts = originalFileName.split('.');
  if (fileParts.length > 1) {
    const ext = sanitizePathPart(fileParts[fileParts.length - 1] || '');
    if (ext) return ext;
  }

  return contentType.startsWith('video/') ? 'mp4' : 'jpg';
}

function getPublicBaseUrl(): string {
  const baseUrl = getRequiredEnv(
    'CLOUDFLARE_R2_PUBLIC_BASE_URL',
    SERVER_CONFIG.CLOUDFLARE_R2_PUBLIC_BASE_URL
  );
  const normalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(
      'Invalid CLOUDFLARE_R2_PUBLIC_BASE_URL. Set it to your Cloudflare R2 public or CDN URL.'
    );
  }

  const host = parsed.hostname.toLowerCase();
  const blockedHosts = new Set(['nearhub.in', 'www.nearhub.in', 'localhost', '127.0.0.1']);
  if (blockedHosts.has(host)) {
    throw new Error(
      `Invalid CLOUDFLARE_R2_PUBLIC_BASE_URL host "${host}". Use your R2 public/CDN host (for example: https://pub-<id>.r2.dev).`
    );
  }

  return normalized;
}

function buildObjectKey(params: {
  mediaType: MediaType;
  contentType: string;
  originalFileName: string;
  userId?: string;
}): string {
  const folder = params.mediaType === 'video' ? 'videos' : 'images';
  const ext = resolveExtension(params.originalFileName, params.contentType);
  const now = new Date();
  const datePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const ownerPrefix = toMediaOwnerKey(params.userId);
  const randomSuffix = crypto.randomUUID();

  return `${folder}/${ownerPrefix}/${datePath}/${randomSuffix}.${ext}`;
}

function maxBytesForType(mediaType: MediaType): number {
  return mediaType === 'video'
    ? SERVER_CONFIG.CLOUDFLARE_R2_MAX_VIDEO_BYTES
    : SERVER_CONFIG.CLOUDFLARE_R2_MAX_IMAGE_BYTES;
}

function ensureR2Enabled(): void {
  if (!SERVER_CONFIG.CLOUDFLARE_R2_ENABLED) {
    throw new Error('Cloudflare R2 is disabled. Set CLOUDFLARE_R2_ENABLED=true');
  }
}

export interface PresignUploadInput {
  mediaType: MediaType;
  contentType: string;
  originalFileName: string;
  fileSizeBytes: number;
  userId?: string;
}

export interface PresignUploadResult {
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  expiresInSeconds: number;
  headers: Record<string, string>;
}

export async function createPresignedUpload(
  input: PresignUploadInput
): Promise<PresignUploadResult> {
  ensureR2Enabled();

  const contentType = normalizeContentType(input.contentType);
  if (!isAllowedContentType(input.mediaType, contentType)) {
    throw new Error(`Unsupported ${input.mediaType} content type: ${input.contentType}`);
  }

  if (!input.fileSizeBytes || input.fileSizeBytes <= 0) {
    throw new Error('fileSizeBytes must be greater than 0');
  }

  const maxBytes = maxBytesForType(input.mediaType);
  if (input.fileSizeBytes > maxBytes) {
    throw new Error(
      `${input.mediaType} exceeds max size of ${(maxBytes / (1024 * 1024)).toFixed(0)}MB`
    );
  }

  const bucket = getRequiredEnv('CLOUDFLARE_R2_BUCKET', SERVER_CONFIG.CLOUDFLARE_R2_BUCKET);
  const expiresInSeconds = SERVER_CONFIG.CLOUDFLARE_R2_PRESIGN_EXPIRES_SECONDS;
  const objectKey = buildObjectKey({
    mediaType: input.mediaType,
    contentType,
    originalFileName: input.originalFileName,
    userId: input.userId,
  });

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: input.fileSizeBytes,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  const publicUrl = `${getPublicBaseUrl()}/${objectKey}`;

  return {
    objectKey,
    uploadUrl,
    publicUrl,
    expiresInSeconds,
    headers: {
      'Content-Type': contentType,
    },
  };
}

function toObjectKey(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    return raw.replace(/^\/+/, '');
  }

  try {
    const url = new URL(raw);
    return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    return '';
  }
}

export async function deleteMediaByKeys(values: string[]): Promise<{
  deleted: string[];
  failed: string[];
}> {
  ensureR2Enabled();

  const bucket = getRequiredEnv('CLOUDFLARE_R2_BUCKET', SERVER_CONFIG.CLOUDFLARE_R2_BUCKET);
  const client = getR2Client();

  const deleted: string[] = [];
  const failed: string[] = [];

  for (const value of values) {
    const objectKey = toObjectKey(value);
    if (!objectKey) {
      failed.push(value);
      continue;
    }

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );
      deleted.push(objectKey);
    } catch {
      failed.push(objectKey);
    }
  }

  return { deleted, failed };
}

export async function uploadBufferAsMedia(params: {
  mediaType: MediaType;
  contentType: string;
  originalFileName: string;
  buffer: Buffer;
  userId?: string;
}): Promise<{ objectKey: string; publicUrl: string }> {
  ensureR2Enabled();

  const contentType = normalizeContentType(params.contentType);
  if (!isAllowedContentType(params.mediaType, contentType)) {
    throw new Error(`Unsupported ${params.mediaType} content type: ${params.contentType}`);
  }
  if (!params.buffer?.length) {
    throw new Error('Media buffer is empty');
  }

  const maxBytes = maxBytesForType(params.mediaType);
  if (params.buffer.length > maxBytes) {
    throw new Error(
      `${params.mediaType} exceeds max size of ${(maxBytes / (1024 * 1024)).toFixed(0)}MB`
    );
  }

  const bucket = getRequiredEnv('CLOUDFLARE_R2_BUCKET', SERVER_CONFIG.CLOUDFLARE_R2_BUCKET);
  const objectKey = buildObjectKey({
    mediaType: params.mediaType,
    contentType,
    originalFileName: params.originalFileName,
    userId: params.userId,
  });
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: params.buffer,
      ContentType: contentType,
      ContentLength: params.buffer.length,
    })
  );
  return {
    objectKey,
    publicUrl: `${getPublicBaseUrl()}/${objectKey}`,
  };
}

export async function uploadLocalFileAsMedia(params: {
  mediaType: MediaType;
  contentType: string;
  originalFileName: string;
  filePath: string;
  userId?: string;
}): Promise<{ objectKey: string; publicUrl: string }> {
  const buffer = await fs.readFile(params.filePath);
  return uploadBufferAsMedia({
    mediaType: params.mediaType,
    contentType: params.contentType,
    originalFileName: params.originalFileName,
    buffer,
    userId: params.userId,
  });
}
