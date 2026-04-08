import express, { type Express } from 'express';
import {
  initializeUpload,
  uploadChunk,
  getUploadProgress,
  finalizeUpload,
  cancelUpload,
} from '../services/video-upload';
import {
  streamVideo,
  getVideoMetadata,
  cacheVideoUrl,
  getStreamingStats,
  invalidateVideoCache,
} from '../services/video-streaming';

function readStringParam(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

export function registerVideoUploadRoutes(app: Express) {
  /**
   * POST /api/videos/initiate
   * Initialize a video upload session
   */
  app.post('/api/videos/initiate', (req, res) => {
    try {
      const { fileName, totalChunks, fileSize } = req.body;

      if (!fileName || !totalChunks || !fileSize) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: fileName, totalChunks, fileSize',
        });
      }

      const result = initializeUpload(fileName, totalChunks, fileSize);
      res.json(result);
    } catch (error) {
      console.error('Error initiating upload:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate upload',
      });
    }
  });

  /**
   * POST /api/videos/upload-chunk
   * Upload a video chunk
   */
  app.post(
    '/api/videos/upload-chunk',
    express.raw({
      type: 'application/octet-stream',
      limit: '10mb',
    }),
    async (req, res) => {
      try {
        let uploadId: string | undefined;
        let chunkIndex: number | undefined;
        let buffer: Buffer | undefined;

        if (Buffer.isBuffer(req.body)) {
          uploadId = readStringParam(req.query.uploadId) || req.get('x-upload-id') || undefined;
          const chunkIndexRaw =
            readStringParam(req.query.chunkIndex) || req.get('x-chunk-index') || undefined;
          chunkIndex = chunkIndexRaw ? Number(chunkIndexRaw) : undefined;
          buffer = req.body;

          if (
            !uploadId ||
            chunkIndex === undefined ||
            Number.isNaN(chunkIndex) ||
            !Number.isInteger(chunkIndex) ||
            chunkIndex < 0 ||
            !buffer.length
          ) {
            return res.status(400).json({
              success: false,
              message:
                'Missing required parameters for binary upload: uploadId, chunkIndex, request body',
            });
          }
        } else {
          const body = req.body as {
            uploadId?: string;
            chunkIndex?: number | string;
            chunkData?: string | null;
          };

          uploadId = body.uploadId;
          chunkIndex =
            typeof body.chunkIndex === 'number'
              ? body.chunkIndex
              : Number(String(body.chunkIndex));

          if (
            !uploadId ||
            chunkIndex === undefined ||
            Number.isNaN(chunkIndex) ||
            !Number.isInteger(chunkIndex) ||
            chunkIndex < 0 ||
            !body.chunkData
          ) {
            return res.status(400).json({
              success: false,
              message: 'Missing required parameters: uploadId, chunkIndex, chunkData',
            });
          }

          // Backward compatibility for clients that still send base64 JSON.
          buffer = Buffer.from(body.chunkData, 'base64');
        }

        await uploadChunk(uploadId, chunkIndex, buffer);

        const progress = getUploadProgress(uploadId);
        res.json({
          success: true,
          progress,
        });
      } catch (error) {
        console.error('Error uploading chunk:', error);
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Failed to upload chunk',
        });
      }
    }
  );

  /**
   * GET /api/videos/progress/:uploadId
   * Check upload progress
   */
  app.get('/api/videos/progress/:uploadId', (req, res) => {
    try {
      const { uploadId } = req.params;

      const progress = getUploadProgress(uploadId);
      res.json(progress);
    } catch {
      res.status(404).json({
        success: false,
        message: 'Upload session not found',
      });
    }
  });

  /**
   * POST /api/videos/finalize
   * Finalize upload by merging chunks
   */
  app.post('/api/videos/finalize', async (req, res) => {
    try {
      const { uploadId, listingId } = req.body;

      if (!uploadId) {
        return res.status(400).json({
          success: false,
          message: 'uploadId is required',
        });
      }

      const videoUrl = await finalizeUpload(uploadId);

      // Cache the video URL if listingId provided
      if (listingId) {
        await cacheVideoUrl(listingId, videoUrl);
      }

      res.json({
        success: true,
        videoUrl,
      });
    } catch (error) {
      console.error('Error finalizing upload:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to finalize upload',
      });
    }
  });

  /**
   * POST /api/videos/cancel
   * Cancel an upload and cleanup
   */
  app.post('/api/videos/cancel', async (req, res) => {
    try {
      const { uploadId } = req.body;

      if (!uploadId) {
        return res.status(400).json({
          success: false,
          message: 'uploadId is required',
        });
      }

      await cancelUpload(uploadId);
      res.json({
        success: true,
        message: 'Upload cancelled',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to cancel upload',
      });
    }
  });

  /**
   * GET /api/videos/stream/:videoId
   * Stream video with range request support (HTTP 206)
   */
  app.get('/api/videos/stream/:videoId', async (req, res) => {
    try {
      const { videoId } = req.params;
      await streamVideo(req, res, videoId);
    } catch (error) {
      console.error('Error streaming video:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to stream video',
      });
    }
  });

  /**
   * GET /api/videos/metadata/:videoId
   * Get cached video metadata
   */
  app.get('/api/videos/metadata/:videoId', async (req, res) => {
    try {
      const { videoId } = req.params;
      const metadata = await getVideoMetadata(videoId);

      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Video not found',
        });
      }

      res.json({
        success: true,
        metadata: {
          fileName: metadata.fileName,
          fileSize: metadata.fileSize,
          resolution: metadata.resolution,
          mimeType: metadata.mimeType,
          duration: metadata.duration,
        },
      });
    } catch {
      res.status(500).json({
        success: false,
        message: 'Failed to get video metadata',
      });
    }
  });

  /**
   * DELETE /api/videos/:videoId
   * Delete video and invalidate cache
   */
  app.delete('/api/videos/:videoId', async (req, res) => {
    try {
      const { videoId } = req.params;

      // Invalidate cache
      await invalidateVideoCache(videoId);

      res.json({
        success: true,
        message: 'Video deleted and cache invalidated',
      });
    } catch {
      res.status(500).json({
        success: false,
        message: 'Failed to delete video',
      });
    }
  });

  /**
   * GET /api/videos/stats
   * Get streaming statistics
   */
  app.get('/api/videos/stats', async (req, res) => {
    try {
      const stats = await getStreamingStats();
      res.json({
        success: true,
        stats,
      });
    } catch {
      res.status(500).json({
        success: false,
        message: 'Failed to get streaming stats',
      });
    }
  });

  /**
   * GET /api/videos/proxy
   * Proxy external video URLs with CORS headers to bypass browser blocking
   * Usage: /api/videos/proxy?url=https://external-video.com/video.mp4
   */
  app.get('/api/videos/proxy', async (req, res) => {
    try {
      const videoUrl = req.query.url as string;

      if (!videoUrl) {
        return res.status(400).json({
          success: false,
          message: 'url parameter is required',
        });
      }

      // Validate URL
      try {
        new URL(videoUrl);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid URL provided',
        });
      }

      // Fetch the video from external source
      const response = await fetch(videoUrl, {
        headers: {
          Range: req.headers.range || 'bytes=0-',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: `Failed to fetch video: ${response.statusText}`,
        });
      }

      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Content-Type');

      // Copy video response headers
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      const contentRange = response.headers.get('content-range');
      const acceptRanges = response.headers.get('accept-ranges');

      if (contentType) res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
        res.status(206); // Partial Content
      }
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

      // Stream the video to client
      if (response.body) {
        const reader = response.body.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        } catch (streamError) {
          console.error('Error streaming video:', streamError);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Error streaming video',
            });
          }
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'No video stream available',
        });
      }
    } catch (error) {
      console.error('Error proxying video:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Failed to proxy video',
        });
      }
    }
  });

  console.log('[VideoUpload] Routes registered');
}
