import type { Express, Request, Response } from 'express';
import { verifyAdminToken } from '../../admin/services/admin-auth';
import { verifyWebUserToken } from '../../auth/services/web-auth';
import {
  createPresignedUpload,
  deleteMediaByKeys,
  uploadBufferAsMedia,
} from '../services/cloudflare-media';
import { processImageBuffer } from '../services/image-processing';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MediaUploadPrincipal = {
  kind: 'admin' | 'user';
  id: string;
};

class MediaUploadAuthorizationError extends Error {
  statusCode = 403;
}

function getBearerToken(req: Request): string {
  const authorization = asString(req.headers.authorization).trim();
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

function resolveMediaUploadPrincipal(req: Request): MediaUploadPrincipal | null {
  const token = getBearerToken(req);
  if (!token) return null;

  const admin = verifyAdminToken(token);
  if (admin?.id) return { kind: 'admin', id: admin.id };

  const user = verifyWebUserToken(token);
  if (user?.id && UUID_REGEX.test(user.id)) return { kind: 'user', id: user.id };

  return null;
}

function resolveMediaOwnerId(req: Request, principal: MediaUploadPrincipal): string {
  const requestedUserId = asString(req.headers['x-user-id']).trim();
  if (principal.kind === 'user') {
    if (requestedUserId && requestedUserId.toLowerCase() !== principal.id.toLowerCase()) {
      throw new MediaUploadAuthorizationError(
        'The upload user does not match the authenticated user'
      );
    }
    return principal.id;
  }

  return requestedUserId || principal.id;
}

export function registerCloudflareMediaRoutes(app: Express) {
  app.post('/api/media/upload-image', async (req: Request, res: Response) => {
    try {
      const principal = resolveMediaUploadPrincipal(req);
      if (!principal) {
        return res.status(401).json({
          success: false,
          error: 'A valid user or admin session is required to upload images',
        });
      }
      const ownerId = resolveMediaOwnerId(req, principal);

      const input = Buffer.isBuffer(req.body) ? req.body : null;
      if (!input?.length) {
        return res.status(400).json({
          success: false,
          error: 'Send the image bytes as the request body',
        });
      }

      const contentType = asString(req.headers['content-type']).split(';')[0].trim().toLowerCase();
      if (!contentType.startsWith('image/')) {
        return res.status(415).json({ success: false, error: 'An image content type is required' });
      }

      const processed = await processImageBuffer(input, asString(req.query.preset));
      const result = await uploadBufferAsMedia({
        mediaType: 'image',
        contentType: processed.contentType,
        originalFileName: asString(req.query.fileName).trim() || 'image',
        buffer: processed.buffer,
        userId: ownerId,
      });

      return res.json({
        success: true,
        data: {
          ...result,
          originalBytes: processed.originalBytes,
          compressedBytes: processed.compressedBytes,
          width: processed.width,
          height: processed.height,
        },
      });
    } catch (error) {
      const statusCode = error instanceof MediaUploadAuthorizationError ? error.statusCode : 400;
      return res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process image',
      });
    }
  });

  app.post('/api/media/presign-upload', async (req: Request, res: Response) => {
    try {
      const mediaTypeRaw = asString(req.body?.mediaType).trim().toLowerCase();
      const mediaType =
        mediaTypeRaw === 'video' ? 'video' : mediaTypeRaw === 'image' ? 'image' : '';
      const contentType = asString(req.body?.contentType).trim();
      const originalFileName = asString(req.body?.fileName).trim() || 'upload';
      const fileSizeBytes = Number(req.body?.fileSizeBytes || 0);
      const userId = asString(req.body?.userId).trim() || undefined;

      if (mediaType === 'video' || mediaType === 'image') {
        return res.status(410).json({
          success: false,
          error:
            mediaType === 'video'
              ? 'Video uploads are no longer supported.'
              : 'Direct image uploads are no longer supported. Use /api/media/upload-image.',
        });
      }

      if (!mediaType || !contentType || !Number.isSafeInteger(fileSizeBytes)) {
        return res.status(400).json({
          success: false,
          error: 'mediaType, contentType, fileSizeBytes are required',
        });
      }

      const signed = await createPresignedUpload({
        mediaType,
        contentType,
        originalFileName,
        fileSizeBytes,
        userId,
      });

      return res.json({
        success: true,
        data: signed,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create presigned URL',
      });
    }
  });

  app.post('/api/media/delete', async (req: Request, res: Response) => {
    try {
      const urls = Array.isArray(req.body?.urls)
        ? req.body.urls.filter((item: unknown): item is string => typeof item === 'string')
        : [];
      const objectKeys = Array.isArray(req.body?.objectKeys)
        ? req.body.objectKeys.filter((item: unknown): item is string => typeof item === 'string')
        : [];

      const targets = [...urls, ...objectKeys];
      if (targets.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Provide urls or objectKeys to delete',
        });
      }

      const result = await deleteMediaByKeys(targets);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete media',
      });
    }
  });
}
