import type { Express, Request, Response } from 'express';

import { adminAuthMiddleware } from './admin-auth';
import { taskScheduler } from '../../../lib/task-scheduler';
import {
  listUserDeletionReviews,
  processApprovedUserDeletions,
  queueInactiveUsersForReview,
  updateUserDeletionReview,
  type UserDeletionReviewStatus,
} from '../../users/services/user-lifecycle';

export function registerAdminUserLifecycleRoutes(app: Express): void {
  app.get(
    '/api/admin/user-lifecycle/reviews',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const statusQuery = String(req.query.status || 'pending')
          .trim()
          .toLowerCase();
        const status = statusQuery === 'all' ? 'all' : (statusQuery as UserDeletionReviewStatus);
        const limit = Number(req.query.limit || 100);
        const offset = Number(req.query.offset || 0);

        const reviews = await listUserDeletionReviews({ status, limit, offset });
        return res.json({
          success: true,
          data: reviews,
          count: reviews.length,
        });
      } catch (error) {
        console.error('[AdminLifecycle] Failed to list reviews:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch review list' });
      }
    }
  );

  app.post(
    '/api/admin/user-lifecycle/scan',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const inactivityDays =
          req.body?.inactivityDays !== undefined ? Number(req.body.inactivityDays) : undefined;
        const limit = Number(req.body?.limit || 500);
        const result = await queueInactiveUsersForReview({ inactivityDays, limit });
        return res.json({
          success: true,
          message: `Queued ${result.queued} inactive users for review`,
          result,
        });
      } catch (error) {
        console.error('[AdminLifecycle] Failed to scan inactive users:', error);
        return res.status(500).json({ success: false, error: 'Failed to scan inactive users' });
      }
    }
  );

  app.patch(
    '/api/admin/user-lifecycle/reviews/:id',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const reviewId = String(req.params.id || '').trim();
        const status = String(req.body?.status || '')
          .trim()
          .toLowerCase() as 'pending' | 'approved' | 'rejected';
        const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
        const reviewedBy = (req as any).admin?.email || (req as any).admin?.id || 'admin';

        if (!reviewId) {
          return res.status(400).json({ success: false, error: 'Review id is required' });
        }
        if (!['pending', 'approved', 'rejected'].includes(status)) {
          return res.status(400).json({
            success: false,
            error: 'status must be one of: pending, approved, rejected',
          });
        }

        const updated = await updateUserDeletionReview({ reviewId, status, reviewedBy, notes });
        if (!updated) {
          return res.status(404).json({ success: false, error: 'Review item not found' });
        }

        return res.json({
          success: true,
          message: `Review ${reviewId} updated to ${status}`,
        });
      } catch (error) {
        console.error('[AdminLifecycle] Failed to update review item:', error);
        return res.status(500).json({ success: false, error: 'Failed to update review item' });
      }
    }
  );

  app.post(
    '/api/admin/user-lifecycle/cleanup/run',
    adminAuthMiddleware,
    async (req: Request, res: Response) => {
      try {
        const limit = Number(req.body?.limit || 100);
        const dryRun = Boolean(req.body?.dryRun);
        const result = await processApprovedUserDeletions({ limit, dryRun });
        return res.json({
          success: true,
          message: dryRun
            ? `Dry run complete. ${result.scanned} approved users evaluated`
            : `Cleanup complete. Deleted ${result.deleted} users`,
          result,
        });
      } catch (error) {
        console.error('[AdminLifecycle] Failed to run cleanup:', error);
        return res.status(500).json({ success: false, error: 'Failed to run cleanup' });
      }
    }
  );

  app.post(
    '/api/admin/user-lifecycle/cleanup/scheduler/run',
    adminAuthMiddleware,
    async (_req: Request, res: Response) => {
      try {
        await taskScheduler.runNow('inactive-user-cleanup');
        return res.json({
          success: true,
          message: 'Inactive user cleanup scheduler executed',
        });
      } catch (error) {
        console.error('[AdminLifecycle] Failed to run scheduler task:', error);
        return res.status(500).json({ success: false, error: 'Failed to run scheduler task' });
      }
    }
  );
}
