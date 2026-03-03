import type { Express } from 'express';
import {
  cleanupListingMedia,
  cleanupMultipleListingsMedia,
  shouldDeleteMedia,
  filterListingsForCleanup,
  runScheduledMediaCleanup,
  type ListingForCleanup,
  type CleanupSummary,
} from '../services/media-cleanup';

export function registerMediaCleanupRoutes(app: Express) {
  /**
   * POST /api/media/cleanup
   * Manually trigger media cleanup for specific listings
   */
  app.post('/api/media/cleanup', async (req, res) => {
    try {
      const { listingIds } = req.body as { listingIds?: string[] };

      if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'listingIds array is required',
        });
      }

      // In a real implementation, fetch listings from database
      // For now, return a mock response
      const mockListings: Array<{
        id: string;
        listingType: 'image' | 'video';
        images: string[];
        videoUrl?: string | null;
      }> = listingIds.map((id) => ({
        id,
        listingType: 'video', // mock
        images: [],
        videoUrl: `/videos/${id}_video.mp4`,
      }));

      const summary = await cleanupMultipleListingsMedia(mockListings);

      res.json({
        success: true,
        summary,
      });
    } catch (error) {
      console.error('Error during manual cleanup:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Cleanup failed',
      });
    }
  });

  /**
   * GET /api/media/cleanup/check
   * Check which listings need media cleanup
   */
  app.get('/api/media/cleanup/check', async (req, res) => {
    try {
      const { mediaDeleteAfterDays = 60 } = req.query;
      const deleteAfterDays = parseInt(mediaDeleteAfterDays as string, 10);

      // In a real implementation, fetch expired listings from database
      const mockExpiredListings: ListingForCleanup[] = [
        {
          id: 'listing-1',
          listingType: 'video',
          images: [],
          videoUrl: '/videos/listing-1_video.mp4',
          expiresAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000), // 70 days ago
          mediaDeletedAt: null,
        },
        {
          id: 'listing-2',
          listingType: 'image',
          images: ['/uploads/listing-2-img1.jpg', '/uploads/listing-2-img2.jpg'],
          videoUrl: null,
          expiresAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000), // 65 days ago
          mediaDeletedAt: null,
        },
        {
          id: 'listing-3',
          listingType: 'video',
          images: [],
          videoUrl: '/videos/listing-3_video.mp4',
          expiresAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago (not yet)
          mediaDeletedAt: null,
        },
      ];

      const listingsNeedingCleanup = filterListingsForCleanup(mockExpiredListings, deleteAfterDays);

      res.json({
        success: true,
        totalExpired: mockExpiredListings.length,
        needingCleanup: listingsNeedingCleanup.length,
        listings: listingsNeedingCleanup.map((l) => ({
          id: l.id,
          listingType: l.listingType,
          expiresAt: l.expiresAt,
          daysSinceExpiry: l.expiresAt
            ? Math.floor((Date.now() - new Date(l.expiresAt).getTime()) / (1000 * 60 * 60 * 24))
            : null,
        })),
      });
    } catch (error) {
      console.error('Error checking cleanup status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check cleanup status',
      });
    }
  });

  /**
   * POST /api/media/cleanup/run-scheduled
   * Run scheduled cleanup job (admin only)
   * In production, this should be called by a cron job, not exposed as HTTP endpoint
   */
  app.post('/api/media/cleanup/run-scheduled', async (req, res) => {
    try {
      const { mediaDeleteAfterDays = 60, adminKey } = req.body;

      // Simple admin authentication (use proper auth in production)
      if (adminKey !== process.env.ADMIN_SECRET_KEY && process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Mock database functions
      const getExpiredListings = async (): Promise<ListingForCleanup[]> => {
        // In real implementation, query database for expired listings
        return [
          {
            id: 'listing-1',
            listingType: 'video',
            images: [],
            videoUrl: '/videos/listing-1_video.mp4',
            expiresAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
            mediaDeletedAt: null,
          },
        ];
      };

      const markMediaAsDeleted = async (listingIds: string[]): Promise<void> => {
        // In real implementation, update database
        console.log(`[MediaCleanup] Marked ${listingIds.length} listings as media deleted`);
      };

      const summary: CleanupSummary = await runScheduledMediaCleanup(
        getExpiredListings,
        markMediaAsDeleted,
        parseInt(mediaDeleteAfterDays, 10)
      );

      res.json({
        success: true,
        summary,
        message: 'Scheduled cleanup completed',
      });
    } catch (error) {
      console.error('Error running scheduled cleanup:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Cleanup failed',
      });
    }
  });

  console.log('[MediaCleanup] Routes registered');
}
