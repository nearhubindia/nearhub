/**
 * Push Notification Service
 * Sends push notifications using Expo Push Notification Service
 */

import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushErrorReceipt } from 'expo-server-sdk';
import { db } from '../../data/db';
import { pushTokens, notificationLogs } from '../../features/admin/models/admin-settings';
import { eq, and, inArray, ilike, or, sql } from 'drizzle-orm';
import { users } from '../../features/users/models/users';
import { listings } from '../../features/admin/models/admin-settings';

// Create Expo SDK client
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

export interface SendPushNotificationOptions {
  title: string;
  body: string;
  data?: Record<string, any>;
  dealUrl?: string;
  imageUrl?: string;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number; // Time to live in seconds
}

export interface BroadcastOptions extends SendPushNotificationOptions {
  userType?: 'buyer' | 'seller' | 'all';
  notificationType: string;
  sentBy?: string; // Admin user ID
  locations?: string[];
  pincodes?: string[];
  centerLatitude?: number;
  centerLongitude?: number;
  radiusKm?: number;
}

/**
 * Send push notification to a single user
 */
export async function sendPushToUser(
  userId: string,
  options: SendPushNotificationOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user's push tokens
    const tokens = await db.query.pushTokens.findMany({
      where: and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)),
    });

    if (tokens.length === 0) {
      console.log(`[Push] No active tokens found for user ${userId}`);
      return { success: false, error: 'No active push tokens' };
    }

    const messages = createPushMessages(
      tokens.map((t: any) => t.token),
      options
    );

    const result = await sendPushMessages(messages);

    // Log notification
    await logNotification({
      userId,
      title: options.title,
      body: options.body,
      data: JSON.stringify(options.data || {}),
      notificationType: options.data?.type || 'general',
      status: result.success ? 'sent' : 'failed',
      sentCount: result.sentCount,
      errorMessage: result.errors.join(', ') || null,
    });

    return {
      success: result.success,
      error: result.errors.length > 0 ? result.errors.join(', ') : undefined,
    };
  } catch (error) {
    console.error('[Push] Error sending notification to user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send push notifications to multiple users
 */
export async function sendPushToUsers(
  userIds: string[],
  options: SendPushNotificationOptions
): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  try {
    // Get all active tokens for these users
    const tokens = await db.query.pushTokens.findMany({
      where: and(inArray(pushTokens.userId, userIds), eq(pushTokens.isActive, true)),
    });

    if (tokens.length === 0) {
      console.log(`[Push] No active tokens found for ${userIds.length} users`);
      return { success: false, sentCount: 0, errors: ['No active push tokens'] };
    }

    const messages = createPushMessages(
      tokens.map((t: any) => t.token),
      options
    );

    const result = await sendPushMessages(messages);

    // Log notification for each user
    await Promise.all(
      userIds.map((userId: string) =>
        logNotification({
          userId,
          title: options.title,
          body: options.body,
          data: JSON.stringify(options.data || {}),
          notificationType: options.data?.type || 'general',
          status: result.success ? 'sent' : 'failed',
          sentCount: 1,
          errorMessage: result.errors.join(', ') || null,
        })
      )
    );

    return result;
  } catch (error) {
    console.error('[Push] Error sending notifications to users:', error);
    return {
      success: false,
      sentCount: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Broadcast push notification to all users or specific user type
 */
export async function broadcastPushNotification(
  options: BroadcastOptions
): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  try {
    const userIds = await resolveTargetUserIds(options);
    const conditions = [eq(pushTokens.isActive, true)];
    if (options.userType && options.userType !== 'all') {
      conditions.push(eq(pushTokens.userType, options.userType));
    }
    if (userIds.length > 0) {
      conditions.push(inArray(pushTokens.userId, userIds));
    }

    const tokens = await db.query.pushTokens.findMany({
      where: and(...conditions),
    });

    if (tokens.length === 0) {
      console.log(`[Push] No active tokens found for broadcast`);
      return { success: false, sentCount: 0, errors: ['No active push tokens'] };
    }

    console.log(
      `[Push] Broadcasting to ${tokens.length} devices (${options.userType || 'all'} users)`
    );

    const messages = createPushMessages(
      tokens.map((t: any) => t.token),
      options
    );

    const result = await sendPushMessages(messages);

    // Log broadcast notification
    await logNotification({
      userId: null,
      userType: options.userType || 'all',
      title: options.title,
      body: options.body,
      data: JSON.stringify(options.data || {}),
      notificationType: options.notificationType,
      status: result.success ? 'sent' : 'failed',
      sentCount: result.sentCount,
      sentBy: options.sentBy,
      errorMessage: result.errors.join(', ') || null,
    });

    return result;
  } catch (error) {
    console.error('[Push] Error broadcasting notification:', error);
    return {
      success: false,
      sentCount: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

async function resolveTargetUserIds(options: BroadcastOptions): Promise<string[]> {
  const locations = (options.locations || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const pincodes = (options.pincodes || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const centerLatitude = Number(options.centerLatitude);
  const centerLongitude = Number(options.centerLongitude);
  const radiusKm = Number(options.radiusKm);

  if (
    locations.length === 0 &&
    pincodes.length === 0 &&
    (!Number.isFinite(centerLatitude) ||
      !Number.isFinite(centerLongitude) ||
      !Number.isFinite(radiusKm))
  ) {
    return [];
  }

  const matched = new Set<string>();

  if (locations.length > 0) {
    const userLocationConditions = locations.map((location) =>
      ilike(users.location, `%${location}%`)
    );
    const listingLocationConditions = locations.map((location) =>
      ilike(listings.location, `%${location}%`)
    );

    const userLocationRows = await db
      .select({ id: users.id })
      .from(users)
      .where(or(...userLocationConditions)!);

    userLocationRows.forEach((row) => {
      if (row.id) matched.add(String(row.id));
    });

    const listingLocationRows = await db
      .select({ sellerId: listings.sellerId })
      .from(listings)
      .where(or(...listingLocationConditions)!);

    listingLocationRows.forEach((row) => {
      if (row.sellerId) matched.add(String(row.sellerId));
    });
  }

  if (pincodes.length > 0) {
    const pincodeConditions = pincodes.map((pincode) => ilike(listings.pincode, `%${pincode}%`));

    const listingPincodeRows = await db
      .select({ sellerId: listings.sellerId })
      .from(listings)
      .where(or(...pincodeConditions)!);

    listingPincodeRows.forEach((row) => {
      if (row.sellerId) matched.add(String(row.sellerId));
    });
  }

  if (
    Number.isFinite(centerLatitude) &&
    Number.isFinite(centerLongitude) &&
    Number.isFinite(radiusKm) &&
    radiusKm > 0
  ) {
    const usersWithCoords = await db.query.users.findMany({
      columns: { id: true, latitude: true, longitude: true },
      where: and(sql`${users.latitude} IS NOT NULL`, sql`${users.longitude} IS NOT NULL`),
    });

    const R = 6371;
    for (const user of usersWithCoords) {
      if (user.latitude === null || user.longitude === null) continue;
      const dLat = ((centerLatitude - Number(user.latitude)) * Math.PI) / 180;
      const dLon = ((centerLongitude - Number(user.longitude)) * Math.PI) / 180;
      const lat1 = Number(user.latitude);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((centerLatitude * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      if (distance <= radiusKm) {
        matched.add(String(user.id));
      }
    }
  }

  return [...matched];
}

/**
 * Register/update push token for a user
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: string,
  deviceId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate token
    if (!Expo.isExpoPushToken(token)) {
      return { success: false, error: 'Invalid Expo push token' };
    }

    // Check if token already exists
    const existing = await db.query.pushTokens.findFirst({
      where: eq(pushTokens.token, token),
    });

    if (existing) {
      // Update existing token
      await db
        .update(pushTokens)
        .set({
          userId,
          platform,
          deviceId: deviceId || null,
          isActive: true,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pushTokens.id, existing.id));

      console.log(`[Push] Updated token for user ${userId}`);
    } else {
      // Insert new token
      await db.insert(pushTokens).values({
        userId,
        token,
        platform,
        deviceId: deviceId || null,
        isActive: true,
        userType: 'buyer', // Default, can be updated later
        lastUsedAt: new Date(),
      });

      console.log(`[Push] Registered new token for user ${userId}`);
    }

    return { success: true };
  } catch (error) {
    console.error('[Push] Error registering token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update user type for push targeting
 */
export async function updateUserType(
  userId: string,
  userType: 'buyer' | 'seller' | 'both'
): Promise<void> {
  await db
    .update(pushTokens)
    .set({ userType, updatedAt: new Date() })
    .where(eq(pushTokens.userId, userId));
}

/**
 * Deactivate push token
 */
export async function deactivatePushToken(token: string): Promise<void> {
  await db
    .update(pushTokens)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(pushTokens.token, token));
}

/**
 * Helper: Create push messages array
 */
function createPushMessages(
  tokens: string[],
  options: SendPushNotificationOptions
): ExpoPushMessage[] {
  // Validate tokens
  const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));

  if (validTokens.length !== tokens.length) {
    console.warn(`[Push] ${tokens.length - validTokens.length} invalid tokens filtered out`);
  }

  return validTokens.map((token) => ({
    to: token,
    sound: options.sound !== null ? options.sound || 'default' : undefined,
    title: options.title,
    body: options.body,
    data: {
      ...(options.data || {}),
      ...(options.dealUrl ? { dealUrl: options.dealUrl, url: options.dealUrl } : {}),
    },
    badge: options.badge,
    channelId: options.channelId || 'default',
    priority: options.priority || 'high',
    ttl: options.ttl,
    ...(options.imageUrl
      ? {
          richContent: {
            image: options.imageUrl,
          },
        }
      : {}),
  }));
}

/**
 * Helper: Send push messages via Expo
 */
async function sendPushMessages(
  messages: ExpoPushMessage[]
): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];
  const errors: string[] = [];
  let sentCount = 0;

  // Send messages in chunks
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);

      // Count successful sends
      sentCount += ticketChunk.filter((ticket) => ticket.status === 'ok').length;

      // Collect errors
      ticketChunk.forEach((ticket, index) => {
        if (ticket.status === 'error') {
          const errorTicket = ticket as ExpoPushErrorReceipt;
          console.error(`[Push] Error sending to ${chunk[index].to}:`, errorTicket.message);
          errors.push(`${errorTicket.message} (${errorTicket.details?.error || 'unknown'})`);
        }
      });
    } catch (error) {
      console.error('[Push] Expo send error:', error);
      errors.push(error instanceof Error ? error.message : 'Send failed');
    }
  }

  console.log(`[Push] Sent ${sentCount}/${messages.length} notifications`);

  return {
    success: sentCount > 0,
    sentCount,
    errors,
  };
}

/**
 * Helper: Log notification to database
 */
async function logNotification(data: {
  userId: string | null;
  userType?: string;
  title: string;
  body: string;
  data: string;
  notificationType: string;
  status: string;
  sentCount: number;
  sentBy?: string;
  errorMessage: string | null;
}): Promise<void> {
  try {
    await db.insert(notificationLogs).values(data);
  } catch (error) {
    console.error('[Push] Error logging notification:', error);
  }
}

/**
 * Get notification statistics
 */
export async function getNotificationStats(): Promise<{
  totalTokens: number;
  activeTokens: number;
  totalSent: number;
  buyers: number;
  sellers: number;
}> {
  const allTokens = await db.query.pushTokens.findMany();
  const activeTokensData = allTokens.filter((t: any) => t.isActive);

  const buyers = activeTokensData.filter(
    (t: any) => t.userType === 'buyer' || t.userType === 'both'
  ).length;
  const sellers = activeTokensData.filter(
    (t: any) => t.userType === 'seller' || t.userType === 'both'
  ).length;

  const logs = await db.query.notificationLogs.findMany();
  const totalSent = logs.reduce((sum: number, log: any) => sum + log.sentCount, 0);

  return {
    totalTokens: allTokens.length,
    activeTokens: activeTokensData.length,
    totalSent,
    buyers,
    sellers,
  };
}
