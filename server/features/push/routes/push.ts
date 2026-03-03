/**
 * Push Notification API Routes
 * Handles push token registration and notification sending
 */

import type { Express, Request, Response } from 'express';
import {
  registerPushToken,
  sendPushToUser,
  sendPushToUsers,
  broadcastPushNotification,
  updateUserType,
  deactivatePushToken,
  getNotificationStats,
} from '../../../shared/services/push-notifications';
import { db } from '../../../data/db';
import { notificationLogs, pushTokens } from '../../admin/models/admin-settings';
import { desc, eq } from 'drizzle-orm';

export function registerPushNotificationRoutes(app: Express) {
  /**
   * POST /api/push/register
   * Register/update push token for a user
   */
  app.post('/api/push/register', async (req: Request, res: Response) => {
    try {
      const { userId, token, platform, deviceId } = req.body;

      if (!userId || !token || !platform) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, token, platform',
        });
      }

      const result = await registerPushToken(userId, token, platform, deviceId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error || 'Failed to register token',
        });
      }

      res.json({
        success: true,
        message: 'Push token registered successfully',
      });
    } catch (error) {
      console.error('[Push API] Register error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  /**
   * POST /api/push/deactivate
   * Deactivate a push token
   */
  app.post('/api/push/deactivate', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token is required',
        });
      }

      await deactivatePushToken(token);

      res.json({
        success: true,
        message: 'Token deactivated successfully',
      });
    } catch (error) {
      console.error('[Push API] Deactivate error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate token',
      });
    }
  });

  /**
   * POST /api/push/update-user-type
   * Update user type for push targeting
   */
  app.post('/api/push/update-user-type', async (req: Request, res: Response) => {
    try {
      const { userId, userType } = req.body;

      if (!userId || !userType) {
        return res.status(400).json({
          success: false,
          message: 'userId and userType are required',
        });
      }

      if (!['buyer', 'seller', 'both'].includes(userType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid userType. Must be: buyer, seller, or both',
        });
      }

      await updateUserType(userId, userType);

      res.json({
        success: true,
        message: 'User type updated successfully',
      });
    } catch (error) {
      console.error('[Push API] Update user type error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user type',
      });
    }
  });

  /**
   * POST /api/push/send
   * Send push notification to a single user
   */
  app.post('/api/push/send', async (req: Request, res: Response) => {
    try {
      const { userId, title, body, data, sound, badge, channelId } = req.body;

      if (!userId || !title || !body) {
        return res.status(400).json({
          success: false,
          message: 'userId, title, and body are required',
        });
      }

      const result = await sendPushToUser(userId, {
        title,
        body,
        data,
        sound,
        badge,
        channelId,
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error || 'Failed to send notification',
        });
      }

      res.json({
        success: true,
        message: 'Notification sent successfully',
      });
    } catch (error) {
      console.error('[Push API] Send error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
      });
    }
  });

  /**
   * POST /api/push/send-multiple
   * Send push notification to multiple users
   */
  app.post('/api/push/send-multiple', async (req: Request, res: Response) => {
    try {
      const { userIds, title, body, data, sound, badge, channelId } = req.body;

      if (!userIds || !Array.isArray(userIds) || !title || !body) {
        return res.status(400).json({
          success: false,
          message: 'userIds (array), title, and body are required',
        });
      }

      const result = await sendPushToUsers(userIds, {
        title,
        body,
        data,
        sound,
        badge,
        channelId,
      });

      res.json({
        success: result.success,
        sentCount: result.sentCount,
        errors: result.errors,
        message: result.success
          ? `Sent to ${result.sentCount} devices`
          : 'Failed to send notifications',
      });
    } catch (error) {
      console.error('[Push API] Send multiple error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send notifications',
      });
    }
  });

  /**
   * POST /api/admin/push/broadcast
   * Broadcast push notification (admin only)
   */
  app.post('/api/admin/push/broadcast', async (req: Request, res: Response) => {
    try {
      const {
        title,
        body,
        data,
        userType,
        notificationType,
        adminId,
        sound,
        badge,
        channelId,
      } = req.body;

      if (!title || !body || !notificationType) {
        return res.status(400).json({
          success: false,
          message: 'title, body, and notificationType are required',
        });
      }

      const result = await broadcastPushNotification({
        title,
        body,
        data,
        userType: userType || 'all',
        notificationType,
        sentBy: adminId,
        sound,
        badge,
        channelId,
      });

      res.json({
        success: result.success,
        sentCount: result.sentCount,
        errors: result.errors,
        message: result.success
          ? `Broadcast sent to ${result.sentCount} devices`
          : result.errors.length > 0
          ? result.errors[0]
          : 'Failed to broadcast notification',
      });
    } catch (error) {
      console.error('[Push API] Broadcast error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to broadcast notification',
      });
    }
  });

  /**
   * GET /api/admin/push/stats
   * Get push notification statistics
   */
  app.get('/api/admin/push/stats', async (req: Request, res: Response) => {
    try {
      const stats = await getNotificationStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('[Push API] Stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get statistics',
      });
    }
  });

  /**
   * GET /api/admin/push/logs
   * Get notification logs (admin only)
   */
  app.get('/api/admin/push/logs', async (req: Request, res: Response) => {
    try {
      const limit = parseInt((req.query.limit as string) || '50');
      const offset = parseInt((req.query.offset as string) || '0');

      const logs = await db.query.notificationLogs.findMany({
        limit,
        offset,
        orderBy: [desc(notificationLogs.sentAt)],
      });

      const total = await db.$count(notificationLogs);

      res.json({
        success: true,
        data: {
          logs,
          total,
          limit,
          offset,
        },
      });
    } catch (error) {
      console.error('[Push API] Logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get logs',
      });
    }
  });

  /**
   * GET /api/admin/push/tokens
   * Get all push tokens (admin only)
   */
  app.get('/api/admin/push/tokens', async (req: Request, res: Response) => {
    try {
      const limit = parseInt((req.query.limit as string) || '100');
      const offset = parseInt((req.query.offset as string) || '0');
      const activeOnly = req.query.activeOnly === 'true';

      const conditions = activeOnly ? eq(pushTokens.isActive, true) : undefined;

      const tokens = await db.query.pushTokens.findMany({
        where: conditions,
        limit,
        offset,
        orderBy: [desc(pushTokens.createdAt)],
      });

      const total = conditions
        ? await db.$count(pushTokens, conditions)
        : await db.$count(pushTokens);

      res.json({
        success: true,
        data: {
          tokens,
          total,
          limit,
          offset,
        },
      });
    } catch (error) {
      console.error('[Push API] Tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get tokens',
      });
    }
  });

  /**
   * POST /api/admin/push/test
   * Send test notification (admin only)
   */
  app.post('/api/admin/push/test', async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId is required',
        });
      }

      const result = await sendPushToUser(userId, {
        title: '🔔 Test Notification',
        body: 'This is a test push notification from NearHub Admin',
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
      });

      res.json({
        success: result.success,
        message: result.success ? 'Test notification sent' : result.error,
      });
    } catch (error) {
      console.error('[Push API] Test error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
      });
    }
  });
}
