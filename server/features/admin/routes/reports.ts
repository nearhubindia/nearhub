import type { Express, Response, Request } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../../data/db';
import { listings } from '../models/admin-settings';
import { users } from '../../users/models/users';

/**
 * Admin Reports Routes
 * Provides analytics and reporting endpoints
 */

export function registerReportsRoutes(app: Express) {
  app.get('/api/admin/reports/recent-activity', async (_req: Request, res: Response) => {
    try {
      const rows = await db
        .select({
          id: listings.id,
          title: listings.title,
          listingType: listings.listingType,
          sellerId: listings.sellerId,
          createdAt: listings.createdAt,
          username: users.username,
        })
        .from(listings)
        .leftJoin(users, eq(listings.sellerId, users.id))
        .orderBy(desc(listings.createdAt))
        .limit(10);

      const activities = rows.map((row) => {
        const type = String(row.listingType || '').toLowerCase();
        const action =
          type === 'video'
            ? 'Posted video listing'
            : type === 'image'
              ? 'Posted image listing'
              : 'Posted new listing';

        return {
          id: row.id,
          user: row.username || 'Unknown user',
          userId: row.sellerId,
          action,
          listingTitle: row.title || '',
          timestamp: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        };
      });

      res.json({ success: true, activities });
    } catch (error) {
      console.error('[Reports] Error fetching recent activity:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch recent activity' });
    }
  });

  /**
   * GET /api/admin/reports/growth
   * User growth report
   */
  app.get('/api/admin/reports/growth', async (req: Request, res: Response) => {
    try {
      // Stub data - can be expanded with real analytics
      res.json({
        success: true,
        data: {
          title: 'User Growth Report',
          period: 'Last 12 months',
          data: [],
          summary: {
            totalNewUsers: 0,
            avgGrowthRate: 0,
            trend: 'stable',
          },
        },
      });
    } catch (error) {
      console.error('[Reports] Error fetching growth report:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch growth report' });
    }
  });

  /**
   * GET /api/admin/reports/performance
   * Listing performance report
   */
  app.get('/api/admin/reports/performance', async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          title: 'Listing Performance',
          topListings: [],
          topCategories: [],
          summary: {
            avgViewsPerListing: 0,
            avgConversionRate: 0,
          },
        },
      });
    } catch (error) {
      console.error('[Reports] Error fetching performance report:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch performance report' });
    }
  });

  /**
   * GET /api/admin/reports/transaction
   * Transaction report
   */
  app.get('/api/admin/reports/transaction', async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          title: 'Transaction Report',
          transactions: [],
          summary: {
            totalRevenue: 0,
            totalTransactions: 0,
            avgTransactionValue: 0,
          },
        },
      });
    } catch (error) {
      console.error('[Reports] Error fetching transaction report:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch transaction report' });
    }
  });

  /**
   * GET /api/admin/reports/moderation
   * Content moderation report
   */
  app.get('/api/admin/reports/moderation', async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          title: 'Content Moderation',
          reports: [],
          summary: {
            pendingReports: 0,
            resolvedReports: 0,
            avgResolutionTime: 0,
          },
        },
      });
    } catch (error) {
      console.error('[Reports] Error fetching moderation report:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch moderation report' });
    }
  });
}
