/**
 * Reminder notification worker
 * Sends time-based reminder pushes for expiring subscriptions and listings.
 */

import { and, desc, eq, gt, lte } from 'drizzle-orm';

import { db } from '../../data/db';
import {
  listings,
  notificationLogs,
  subscriptionTiers,
  userSubscriptions,
  type Listing,
} from '../../features/admin/models/admin-settings';
import {
  notifyListingExpiringSoon,
  notifySubscriptionRenewal,
} from './auto-notifications';

const REMINDER_DAYS = [7, 3, 1] as const;
const LOOKBACK_HOURS = 72;
const DAY_MS = 24 * 60 * 60 * 1000;

type NotificationLogRow = {
  data: string | null;
};

type ReminderSummary = {
  checked: number;
  sent: number;
  skipped: number;
  errors: number;
};

function getReminderBucket(expiresAt: Date, now: Date): number | null {
  const diff = expiresAt.getTime() - now.getTime();
  if (diff <= 0) return null;

  const daysLeft = Math.ceil(diff / DAY_MS);
  return REMINDER_DAYS.includes(daysLeft as (typeof REMINDER_DAYS)[number]) ? daysLeft : null;
}

function buildReminderKey(kind: 'subscription' | 'listing', id: string, bucket: number, expiresAt: Date): string {
  return `${kind}:${id}:${bucket}:${expiresAt.toISOString()}`;
}

function parseLogData(data: string | null): Record<string, unknown> | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function wasReminderAlreadySent(
  userId: string,
  notificationType: string,
  reminderKey: string,
  now: Date
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const recentLogs = (await db
    .select({
      data: notificationLogs.data,
    })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.userId, userId),
        eq(notificationLogs.notificationType, notificationType),
        gt(notificationLogs.sentAt, cutoff)
      )
    )
    .orderBy(desc(notificationLogs.sentAt))
    .limit(20)) as NotificationLogRow[];

  return recentLogs.some((log) => {
    const data = parseLogData(log.data);
    return data?.reminderKey === reminderKey;
  });
}

export async function sendExpiryReminderNotifications(): Promise<ReminderSummary> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * DAY_MS);
  const summary: ReminderSummary = {
    checked: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
  };

  console.log('[ReminderWorker] Checking expiring subscriptions and listings...');

  try {
    const [subscriptionRows, listingRows] = await Promise.all([
      db
        .select({
          id: userSubscriptions.id,
          userId: userSubscriptions.userId,
          expiresAt: userSubscriptions.expiresAt,
          planName: subscriptionTiers.name,
        })
        .from(userSubscriptions)
        .innerJoin(subscriptionTiers, eq(userSubscriptions.subscriptionTierId, subscriptionTiers.id))
        .where(
          and(
            eq(userSubscriptions.status, 'active'),
            gt(userSubscriptions.expiresAt, now),
            lte(userSubscriptions.expiresAt, in7Days)
          )
        ),
      db
        .select({
          id: listings.id,
          sellerId: listings.sellerId,
          title: listings.title,
          expiresAt: listings.expiresAt,
        })
        .from(listings)
        .where(
          and(
            eq(listings.isActive, true),
            eq(listings.status, 'active'),
            gt(listings.expiresAt, now),
            lte(listings.expiresAt, in7Days)
          )
        ),
    ]);

    summary.checked = subscriptionRows.length + listingRows.length;

    for (const row of subscriptionRows) {
      const expiresAt = new Date(row.expiresAt);
      const bucket = getReminderBucket(expiresAt, now);
      if (!bucket) {
        summary.skipped += 1;
        continue;
      }

      const reminderKey = buildReminderKey('subscription', row.id, bucket, expiresAt);
      if (await wasReminderAlreadySent(row.userId, 'subscription_renewal', reminderKey, now)) {
        summary.skipped += 1;
        continue;
      }

      await notifySubscriptionRenewal(
        row.userId,
        row.planName || 'Subscription Plan',
        expiresAt,
        bucket,
        reminderKey
      );
      summary.sent += 1;
    }

    for (const row of listingRows) {
      if (!row.expiresAt) {
        summary.skipped += 1;
        continue;
      }

      const expiresAt = new Date(row.expiresAt);
      const bucket = getReminderBucket(expiresAt, now);
      if (!bucket) {
        summary.skipped += 1;
        continue;
      }

      const reminderKey = buildReminderKey('listing', row.id, bucket, expiresAt);
      if (await wasReminderAlreadySent(row.sellerId, 'expiring_soon', reminderKey, now)) {
        summary.skipped += 1;
        continue;
      }

      await notifyListingExpiringSoon(
        {
          id: row.id,
          title: row.title,
          expiresAt,
        } as Listing,
        row.sellerId,
        bucket,
        bucket,
        reminderKey
      );
      summary.sent += 1;
    }

    console.log(
      `[ReminderWorker] Completed reminder scan. checked=${summary.checked} sent=${summary.sent} skipped=${summary.skipped}`
    );
    return summary;
  } catch (error) {
    summary.errors += 1;
    console.error('[ReminderWorker] Error while sending reminders:', error);
    return summary;
  }
}
