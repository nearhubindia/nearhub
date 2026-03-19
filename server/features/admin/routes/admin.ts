import type { Express, Request, Response } from 'express';
import { count, eq } from 'drizzle-orm';
import { db } from '../../../data/db';
import {
  reportUser,
  getUserSpamProfile,
  getUserReports,
  getReportsByStatus,
  blockUser,
  unblockUser,
  reviewReport,
  isUserBlocked,
  getTrendingSpamReasons,
  getHighRiskUsers,
} from '../../users/services/spam-detector';
import { msg91 } from '../../../shared/notifications/msg91';
import {
  notifyAccountSuspended,
  notifyAccountUnsuspended,
  notifyReportReviewed,
} from '../../../shared/services/auto-notifications';

export function registerAdminRoutes(app: Express) {
  const getErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error && error.message ? error.message : fallback;

  // ==================== SPAM / REPORTING ====================

  app.post('/api/report-user', (req: Request, res: Response) => {
    try {
      const { reportedUserId, reporterUserId, reason, description, listingId } = req.body;
      if (!reportedUserId || !reporterUserId || !reason) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const validReasons = ['spam', 'scam', 'harassment', 'inappropriate', 'other'];
      if (!validReasons.includes(reason)) {
        return res.status(400).json({ error: 'Invalid reason' });
      }
      const report = reportUser(reportedUserId, reporterUserId, reason, description, listingId);
      res.json({ success: true, report });
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error, 'Failed to report user') });
    }
  });

  app.get('/api/user-spam-profile/:userId', (req: Request, res: Response) => {
    try {
      const profile = getUserSpamProfile(req.params.userId as string);
      res.json(profile || { spamScore: 0, isBlocked: false, totalReports: 0 });
    } catch {
      res.status(500).json({ error: 'Failed to fetch spam profile' });
    }
  });

  app.get('/api/is-user-blocked/:userId', (req: Request, res: Response) => {
    try {
      res.json({ isBlocked: isUserBlocked(req.params.userId as string) });
    } catch {
      res.status(500).json({ error: 'Failed to check user block status' });
    }
  });

  app.get('/api/admin/user-reports/:userId', (req: Request, res: Response) => {
    try {
      const reports = getUserReports(req.params.userId as string);
      res.json({ reports, count: reports.length });
    } catch {
      res.status(500).json({ error: 'Failed to fetch user reports' });
    }
  });

  app.get('/api/admin/pending-reports', (_req: Request, res: Response) => {
    try {
      const reports = getReportsByStatus('pending');
      res.json({ reports, count: reports.length });
    } catch {
      res.status(500).json({ error: 'Failed to fetch pending reports' });
    }
  });

  app.post('/api/admin/review-report', (req: Request, res: Response) => {
    try {
      const { reportId, status, adminNotes } = req.body;
      if (!reportId || !status) return res.status(400).json({ error: 'Missing required fields' });
      const report = reviewReport(reportId, status, adminNotes || '');
      if (!report) return res.status(404).json({ error: 'Report not found' });

      // Send notification to reporter and reported user
      notifyReportReviewed(
        report.reporterUserId,
        report.reportedUserId,
        status === 'reviewed' ? 'approved' : 'dismissed',
        report.reason
      ).catch((err) => console.error('[Admin] Failed to send report reviewed notification:', err));

      res.json({ success: true, report });
    } catch {
      res.status(500).json({ error: 'Failed to review report' });
    }
  });

  app.post('/api/admin/block-user', (req: Request, res: Response) => {
    try {
      const { userId, reason } = req.body;
      if (!userId || !reason) return res.status(400).json({ error: 'Missing required fields' });
      const profile = blockUser(userId, reason);

      // Send suspension notification
      notifyAccountSuspended(userId, reason).catch((err) =>
        console.error('[Admin] Failed to send account suspended notification:', err)
      );

      res.json({ success: true, profile });
    } catch {
      res.status(500).json({ error: 'Failed to block user' });
    }
  });

  app.post('/api/admin/unblock-user', (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'Missing user ID' });
      const profile = unblockUser(userId);

      // Send account restored notification
      notifyAccountUnsuspended(userId).catch((err) =>
        console.error('[Admin] Failed to send account unsuspended notification:', err)
      );

      res.json({ success: true, profile });
    } catch {
      res.status(500).json({ error: 'Failed to unblock user' });
    }
  });

  app.get('/api/admin/trending-spam', (_req: Request, res: Response) => {
    try {
      res.json({ trends: getTrendingSpamReasons() });
    } catch {
      res.status(500).json({ error: 'Failed to fetch trending spam reasons' });
    }
  });

  app.get('/api/admin/high-risk-users', (req: Request, res: Response) => {
    try {
      const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : 50;
      const users = getHighRiskUsers(threshold);
      res.json({ users, count: users.length });
    } catch {
      res.status(500).json({ error: 'Failed to fetch high-risk users' });
    }
  });

  // ==================== DASHBOARD STATS ====================

  app.get('/api/admin/dashboard/stats', async (_req: Request, res: Response) => {
    try {
      const [{ listings }, { users }] = await Promise.all([
        import('../../admin/models/admin-settings'),
        import('../../users/models/users'),
      ]);

      const [activeListingsResult, videoUploadsResult, totalUsersResult] = await Promise.all([
        db.select({ value: count() }).from(listings).where(eq(listings.isActive, true)),
        db.select({ value: count() }).from(listings).where(eq(listings.listingType, 'video')),
        db.select({ value: count() }).from(users),
      ]);

      res.json({
        success: true,
        stats: {
          activeListings: activeListingsResult[0]?.value || 0,
          totalUsers: totalUsersResult[0]?.value || 0,
          spamReports: getReportsByStatus('pending').length,
          videoUploads: videoUploadsResult[0]?.value || 0,
        },
      });
    } catch (error) {
      console.error('[Admin Stats] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard stats',
        stats: { activeListings: 0, totalUsers: 0, spamReports: 0, videoUploads: 0 },
      });
    }
  });

  // ==================== MSG91 TESTING ====================

  const sendSmsTestHandler = async (req: Request, res: Response) => {
    try {
      const { phone, message } = req.body;
      if (!phone || !message)
        return res.status(400).json({ success: false, error: 'Phone and message are required' });
      const response = await msg91.sendSMS({ phone, message });
      res.json({ success: response.success, messageId: response.messageId, error: response.error });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS',
      });
    }
  };
  app.post('/api/admin/test/msg91/send-sms', sendSmsTestHandler);
  // Backward-compatible alias (deprecated)
  app.post('/api/test/msg91/send-sms', sendSmsTestHandler);

  const sendOtpTestHandler = async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;
      if (!phone)
        return res.status(400).json({ success: false, error: 'Phone number is required' });
      const response = await msg91.sendOTP({ phone, otp: '123456' });
      res.json({ success: response.success, messageId: response.messageId, error: response.error });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send OTP',
      });
    }
  };
  app.post('/api/admin/test/msg91/send-otp', sendOtpTestHandler);
  // Backward-compatible alias (deprecated)
  app.post('/api/test/msg91/send-otp', sendOtpTestHandler);

  const getMsg91StatusHandler = (_req: Request, res: Response) => {
    try {
      const status = msg91.getStatus();
      res.json({ success: true, service: 'MSG91', status, apiConfigured: status.configured });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status',
      });
    }
  };
  app.get('/api/admin/test/msg91/status', getMsg91StatusHandler);
  // Backward-compatible alias (deprecated)
  app.get('/api/test/msg91/status', getMsg91StatusHandler);
}
