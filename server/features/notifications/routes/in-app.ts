/**
 * In-App Notifications API Routes
 * Persistent notification feed within the app
 */

import type { Express, Request, Response } from 'express';
import {
  createInAppNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats,
  deleteExpiredNotifications,
  broadcastInAppNotification,
} from '../../../shared/services/in-app-notifications';
import { db } from '../../../data/db';
import { inAppNotifications } from '../../admin/models/admin-settings';
import { desc } from 'drizzle-orm';

export function registerInAppNotificationRoutes(app: Express) {
  /**
   * GET /api/notifications
   * Get notifications for the logged-in user
   */
  app.get('/api/notifications', async (req: Request, res: Response) => {
    try {
      // In production, get userId from auth middleware
      const userId = (req as any).user?.id || (req.query.userId as string);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID required',
        });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await getUserNotifications(userId, limit);

      res.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      console.error('[InAppNotifications] Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      });
    }
  });

  /**
   * POST /api/notifications/:id/read
   * Mark a notification as read
   */
  app.post('/api/notifications/:id/read', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || req.body.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID required',
        });
      }

      const result = await markAsRead(String(id), String(userId));

      res.json(result);
    } catch (error) {
      console.error('[InAppNotifications] Error marking as read:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      });
    }
  });

  /**
   * POST /api/notifications/read-all
   * Mark all notifications as read for the user
   */
  app.post('/api/notifications/read-all', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || req.body.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID required',
        });
      }

      const result = await markAllAsRead(userId);

      res.json(result);
    } catch (error) {
      console.error('[InAppNotifications] Error marking all as read:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      });
    }
  });

  /**
   * GET /api/notifications/unread-count
   * Get count of unread notifications
   */
  app.get('/api/notifications/unread-count', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || (req.query.userId as string);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID required',
        });
      }

      const notifications = await getUserNotifications(userId, 100);
      const unreadCount = notifications.filter((n: any) => !n.isRead).length;

      res.json({
        success: true,
        count: unreadCount,
      });
    } catch (error) {
      console.error('[InAppNotifications] Error counting unread:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      });
    }
  });

  // ==================== ADMIN ROUTES ====================

  /**
   * POST /api/admin/notifications/create
   * Create a new in-app notification
   */
  app.post('/api/admin/notifications/create', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        userType,
        title,
        message,
        type,
        actionLabel,
        actionUrl,
        category,
        referenceId,
        priority,
        expiresAt,
      } = req.body;

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Title and message are required',
        });
      }

      const result = await createInAppNotification({
        userId: userId || null,
        userType: userType || 'all',
        title,
        message,
        type: type || 'info',
        actionLabel,
        actionUrl,
        category,
        referenceId,
        priority: priority || 'normal',
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        createdBy: (req as any).user?.id, // Admin user ID
      });

      if (!result.success) {
        return res.status(500).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('[InAppNotifications] Error creating notification:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      });
    }
  });

  /**
   * POST /api/admin/notifications/broadcast
   * Broadcast notification to all users or specific user type
   */
  app.post('/api/admin/notifications/broadcast', async (req: Request, res: Response) => {
    try {
      const {
        userType,
        title,
        message,
        type,
        actionLabel,
        actionUrl,
        category,
        priority,
        expiresAt,
      } = req.body;

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Title and message are required',
        });
      }

      const result = await createInAppNotification({
        userId: null,
        userType: userType || 'all',
        title,
        message,
        type: type || 'info',
        actionLabel,
        actionUrl,
        category,
        priority: priority || 'normal',
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        createdBy: (req as any).user?.id,
      });

      if (!result.success) {
        return res.status(500).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('[InAppNotifications] Error broadcasting:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      });
    }
  });

  /**
   * GET /api/admin/notifications/all
   * Get all in-app notifications (admin view)
   */
  app.get('/api/admin/notifications/all', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;

      const notifications = await db.query.inAppNotifications.findMany({
        orderBy: [desc(inAppNotifications.createdAt)],
        limit,
      });

      res.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      console.error('[InAppNotifications] Error fetching all:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      });
    }
  });

  /**
   * GET /api/admin/notifications/stats
   * Get notification statistics
   */
  app.get('/api/admin/notifications/stats', async (req: Request, res: Response) => {
    try {
      const stats = await getNotificationStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('[InAppNotifications] Error fetching stats:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      });
    }
  });

  /**
   * DELETE /api/admin/notifications/:id
   * Delete a notification
   */
  app.delete('/api/admin/notifications/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await deleteNotification(String(id));

      res.json(result);
    } catch (error) {
      console.error('[InAppNotifications] Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      });
    }
  });

  /**
   * POST /api/admin/notifications/cleanup
   * Delete expired notifications
   */
  app.post('/api/admin/notifications/cleanup', async (req: Request, res: Response) => {
    try {
      const result = await deleteExpiredNotifications();

      res.json({
        success: true,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error('[InAppNotifications] Error cleaning up:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      });
    }
  });
}
