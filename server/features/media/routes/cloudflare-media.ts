import type { Express, Request, Response } from 'express';
import { createPresignedUpload, deleteMediaByKeys } from '../services/cloudflare-media';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function registerCloudflareMediaRoutes(app: Express) {
  app.post('/api/media/presign-upload', async (req: Request, res: Response) => {
    try {
      const mediaTypeRaw = asString(req.body?.mediaType).trim().toLowerCase();
      const mediaType =
        mediaTypeRaw === 'video' ? 'video' : mediaTypeRaw === 'image' ? 'image' : '';
      const contentType = asString(req.body?.contentType).trim();
      const originalFileName = asString(req.body?.fileName).trim() || 'upload';
      const fileSizeBytes = Number(req.body?.fileSizeBytes || 0);
      const userId = asString(req.body?.userId).trim() || undefined;

      if (!mediaType || !contentType || !fileSizeBytes) {
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
