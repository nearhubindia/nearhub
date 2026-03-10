/**
 * In-App Notifications Service
 * Manages persistent notification feed within the app
 */

import { db } from '../../data/db';
import { inAppNotifications } from '../../features/admin/models/admin-settings';
import { eq, and, desc, isNull, or, lt } from 'drizzle-orm';

export interface CreateInAppNotificationOptions {
  userId?: string | null;
  userType?: 'buyer' | 'seller' | 'admin' | 'all';
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  actionLabel?: string;
  actionUrl?: string;
  category?: string;
  referenceId?: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  expiresAt?: Date;
  createdBy?: string;
}

/**
 * Create a new in-app notification
 */
export async function createInAppNotification(
  options: CreateInAppNotificationOptions
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const [notification] = await db
      .insert(inAppNotifications)
      .values({
        userId: options.userId || null,
        userType: options.userType || 'all',
        title: options.title,
        message: options.message,
        type: options.type || 'info',
        actionLabel: options.actionLabel || null,
        actionUrl: options.actionUrl || null,
        category: options.category || null,
        referenceId: options.referenceId || null,
        priority: options.priority || 'normal',
        expiresAt: options.expiresAt || null,
        createdBy: options.createdBy || null,
      })
      .returning({ id: inAppNotifications.id });

    return { success: true, id: notification.id };
  } catch (error) {
    console.error('[InAppNotification] Error creating notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get notifications for a specific user
 */
export async function getUserNotifications(userId: string, limit = 50): Promise<any[]> {
  try {
    // Get notifications for this user or all users
    const notifications = await db.query.inAppNotifications.findMany({
      where: or(
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.userType, 'all'),
        isNull(inAppNotifications.userId)
      ),
      orderBy: [desc(inAppNotifications.createdAt)],
      limit,
    });

    // Filter out expired notifications
    const now = new Date();
    return notifications.filter((n: any) => {
      if (!n.expiresAt) return true;
      return new Date(n.expiresAt) > now;
    });
  } catch (error) {
    console.error('[InAppNotification] Error fetching notifications:', error);
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<{ success: boolean }> {
  try {
    await db
      .update(inAppNotifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(inAppNotifications.id, notificationId),
          or(eq(inAppNotifications.userId, userId), isNull(inAppNotifications.userId))
        )
      );

    return { success: true };
  } catch (error) {
    console.error('[InAppNotification] Error marking as read:', error);
    return { success: false };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<{ success: boolean }> {
  try {
    await db
      .update(inAppNotifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(or(eq(inAppNotifications.userId, userId), eq(inAppNotifications.userType, 'all')));

    return { success: true };
  } catch (error) {
    console.error('[InAppNotification] Error marking all as read:', error);
    return { success: false };
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string): Promise<{ success: boolean }> {
  try {
    await db.delete(inAppNotifications).where(eq(inAppNotifications.id, notificationId));

    return { success: true };
  } catch (error) {
    console.error('[InAppNotification] Error deleting notification:', error);
    return { success: false };
  }
}

/**
 * Get notification statistics
 */
export async function getNotificationStats(): Promise<{
  total: number;
  unread: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
}> {
  try {
    const notifications = await db.query.inAppNotifications.findMany();

    const stats = {
      total: notifications.length,
      unread: notifications.filter((n: any) => !n.isRead).length,
      byType: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
    };

    notifications.forEach((n: any) => {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      if (n.category) {
        stats.byCategory[n.category] = (stats.byCategory[n.category] || 0) + 1;
      }
    });

    return stats;
  } catch (error) {
    console.error('[InAppNotification] Error getting stats:', error);
    return { total: 0, unread: 0, byType: {}, byCategory: {} };
  }
}

/**
 * Delete expired notifications (cleanup job)
 */
export async function deleteExpiredNotifications(): Promise<{ deletedCount: number }> {
  try {
    const now = new Date();
    const result = await db
      .delete(inAppNotifications)
      .where(lt(inAppNotifications.expiresAt, now))
      .returning({ id: inAppNotifications.id });

    return { deletedCount: result.length };
  } catch (error) {
    console.error('[InAppNotification] Error deleting expired:', error);
    return { deletedCount: 0 };
  }
}

/**
 * Broadcast notification to all users
 */
export async function broadcastInAppNotification(
  options: Omit<CreateInAppNotificationOptions, 'userId' | 'userType'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  return createInAppNotification({
    ...options,
    userId: null,
    userType: 'all',
  });
}
