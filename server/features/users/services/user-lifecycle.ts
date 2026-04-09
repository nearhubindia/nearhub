import { and, asc, desc, eq, inArray, lte, or, sql } from 'drizzle-orm';

import { db } from '../../../data/db';
import { getAdminSettings } from '../../admin/services/admin-settings';
import {
  chatConversations,
  chatMessages,
  couponUsage,
  inAppNotifications,
  listings,
  pushTokens,
  userActivity,
  userDeletionReviews,
  userStarterCredits,
  userSubscriptions,
} from '../../admin/models/admin-settings';
import { users } from '../models/users';
import { getUserById, normalizePhone, removeUserProfile } from './user-profiles';

export type UserDeletionReviewStatus = 'pending' | 'approved' | 'rejected' | 'deleted' | 'failed';

export type UserDeletionImpact = {
  listings: number;
  subscriptions: number;
  starterCredits: number;
  conversations: number;
  messages: number;
  notifications: number;
  pushTokens: number;
  couponUsage: number;
};

function normalizeUserId(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

async function resolveCanonicalUserId(candidateUserId: string): Promise<string> {
  const candidate = normalizeUserId(candidateUserId);
  if (!candidate || !isUuid(candidate)) return '';

  const byId = await db.query.users.findFirst({
    where: eq(users.id, candidate),
    columns: { id: true },
  });
  if (byId?.id) return byId.id;

  const memoryUser = getUserById(candidate);
  const normalizedPhone = normalizePhone(memoryUser?.phone || '');
  if (normalizedPhone) {
    const byMobile = await db.query.users.findFirst({
      where: eq(users.mobile, normalizedPhone),
      columns: { id: true },
    });
    if (byMobile?.id) return byMobile.id;
  }
  return '';
}

export async function resolveUserIdFromRequest(req: {
  get: (name: string) => string | undefined;
  path?: string;
}): Promise<string> {
  const rawUserId = req.get('x-user-id');
  if (typeof rawUserId !== 'string' || !rawUserId.trim()) return '';

  const candidate = rawUserId.trim();
  return resolveCanonicalUserId(candidate);
}

export async function touchUserActivity(input: {
  userId: string;
  ip?: string;
  userAgent?: string;
  isCanonicalUserId?: boolean;
}): Promise<void> {
  const userId = input.isCanonicalUserId
    ? normalizeUserId(input.userId)
    : normalizeUserId(await resolveCanonicalUserId(input.userId));
  if (!userId) return;

  const now = new Date();
  await db
    .insert(userActivity)
    .values({
      userId,
      firstSeenAt: now,
      lastSeenAt: now,
      lastSeenIp: input.ip || null,
      lastSeenUserAgent: input.userAgent || null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userActivity.userId,
      set: {
        lastSeenAt: now,
        lastSeenIp: input.ip || null,
        lastSeenUserAgent: input.userAgent || null,
        updatedAt: now,
      },
    });
}

export async function getUserDeletionImpact(userId: string): Promise<UserDeletionImpact> {
  const normalizedUserId = normalizeUserId(userId);
  const conversationFilter = or(
    eq(chatConversations.buyerId, normalizedUserId),
    eq(chatConversations.sellerId, normalizedUserId)
  )!;
  const messageFilter = or(
    eq(chatMessages.senderId, normalizedUserId),
    eq(chatMessages.recipientId, normalizedUserId)
  )!;

  const [
    listingCountRow,
    subscriptionCountRow,
    starterCreditsCountRow,
    conversationCountRow,
    messageCountRow,
    notificationCountRow,
    pushTokenCountRow,
    couponUsageCountRow,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(listings)
      .where(eq(listings.sellerId, normalizedUserId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, normalizedUserId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userStarterCredits)
      .where(eq(userStarterCredits.userId, normalizedUserId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatConversations)
      .where(conversationFilter),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(messageFilter),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(inAppNotifications)
      .where(eq(inAppNotifications.userId, normalizedUserId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(pushTokens)
      .where(eq(pushTokens.userId, normalizedUserId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponUsage)
      .where(eq(couponUsage.userId, normalizedUserId)),
  ]);

  return {
    listings: Number(listingCountRow[0]?.count || 0),
    subscriptions: Number(subscriptionCountRow[0]?.count || 0),
    starterCredits: Number(starterCreditsCountRow[0]?.count || 0),
    conversations: Number(conversationCountRow[0]?.count || 0),
    messages: Number(messageCountRow[0]?.count || 0),
    notifications: Number(notificationCountRow[0]?.count || 0),
    pushTokens: Number(pushTokenCountRow[0]?.count || 0),
    couponUsage: Number(couponUsageCountRow[0]?.count || 0),
  };
}

export async function queueInactiveUsersForReview(options?: {
  inactivityDays?: number;
  limit?: number;
}): Promise<{
  inactivityDays: number;
  cutoff: string;
  scanned: number;
  queued: number;
  skippedAlreadyQueued: number;
}> {
  const settings = await getAdminSettings();
  const configuredDays = Number(settings.inactiveUserReviewDays || 90);
  const inactivityDays = Math.max(1, Number(options?.inactivityDays ?? configuredDays));
  const limit = Math.max(1, Math.min(2000, Number(options?.limit || 500)));
  const cutoffDate = new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000);

  const candidates = await db
    .select({
      userId: userActivity.userId,
      lastSeenAt: userActivity.lastSeenAt,
    })
    .from(userActivity)
    .where(lte(userActivity.lastSeenAt, cutoffDate))
    .orderBy(asc(userActivity.lastSeenAt))
    .limit(limit);

  if (candidates.length === 0) {
    return {
      inactivityDays,
      cutoff: cutoffDate.toISOString(),
      scanned: 0,
      queued: 0,
      skippedAlreadyQueued: 0,
    };
  }

  const candidateIds = candidates.map((c) => c.userId);
  const activeReviews = await db
    .select({
      userId: userDeletionReviews.userId,
    })
    .from(userDeletionReviews)
    .where(
      and(
        inArray(userDeletionReviews.userId, candidateIds),
        or(eq(userDeletionReviews.status, 'pending'), eq(userDeletionReviews.status, 'approved'))
      )
    );
  const activeReviewUserIds = new Set(activeReviews.map((row) => row.userId));

  const rowsToInsert = candidates
    .filter((c) => !activeReviewUserIds.has(c.userId))
    .map((c) => ({
      userId: c.userId,
      lastSeenAt: c.lastSeenAt,
      status: 'pending' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

  if (rowsToInsert.length > 0) {
    await db.insert(userDeletionReviews).values(rowsToInsert);
  }

  return {
    inactivityDays,
    cutoff: cutoffDate.toISOString(),
    scanned: candidates.length,
    queued: rowsToInsert.length,
    skippedAlreadyQueued: candidates.length - rowsToInsert.length,
  };
}

export async function listUserDeletionReviews(options?: {
  status?: UserDeletionReviewStatus | 'all';
  limit?: number;
  offset?: number;
}): Promise<
  Array<{
    id: string;
    userId: string;
    status: UserDeletionReviewStatus;
    lastSeenAt: string;
    reviewedBy: string | null;
    reviewedAt: string | null;
    processedAt: string | null;
    notes: string | null;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
    impact: UserDeletionImpact;
  }>
> {
  const limit = Math.max(1, Math.min(500, Number(options?.limit || 100)));
  const offset = Math.max(0, Number(options?.offset || 0));
  const status = options?.status || 'pending';

  const whereClause =
    status === 'all'
      ? undefined
      : eq(userDeletionReviews.status, status as UserDeletionReviewStatus);
  const rows = whereClause
    ? await db
        .select()
        .from(userDeletionReviews)
        .where(whereClause)
        .orderBy(desc(userDeletionReviews.createdAt))
        .limit(limit)
        .offset(offset)
    : await db
        .select()
        .from(userDeletionReviews)
        .orderBy(desc(userDeletionReviews.createdAt))
        .limit(limit)
        .offset(offset);

  const impactRows = await Promise.all(rows.map((row) => getUserDeletionImpact(row.userId)));
  return rows.map((row, index) => ({
    id: row.id,
    userId: row.userId,
    status: row.status as UserDeletionReviewStatus,
    lastSeenAt: row.lastSeenAt.toISOString(),
    reviewedBy: row.reviewedBy || null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
    notes: row.notes || null,
    lastError: row.lastError || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    impact: impactRows[index],
  }));
}

export async function updateUserDeletionReview(input: {
  reviewId: string;
  status: Extract<UserDeletionReviewStatus, 'pending' | 'approved' | 'rejected'>;
  reviewedBy: string;
  notes?: string;
}): Promise<boolean> {
  const now = new Date();
  const result = await db
    .update(userDeletionReviews)
    .set({
      status: input.status,
      reviewedBy: input.reviewedBy,
      reviewedAt: now,
      notes: typeof input.notes === 'string' ? input.notes.trim() : null,
      updatedAt: now,
      ...(input.status === 'pending' ? { processedAt: null, lastError: null } : {}),
    })
    .where(eq(userDeletionReviews.id, input.reviewId))
    .returning({ id: userDeletionReviews.id });

  return result.length > 0;
}

async function hardDeleteUserData(userId: string): Promise<UserDeletionImpact> {
  const impact = await getUserDeletionImpact(userId);
  const conversationFilter = or(
    eq(chatConversations.buyerId, userId),
    eq(chatConversations.sellerId, userId)
  )!;
  const messageFilter = or(
    eq(chatMessages.senderId, userId),
    eq(chatMessages.recipientId, userId)
  )!;

  await db.transaction(async (tx) => {
    await tx.delete(chatMessages).where(messageFilter);
    await tx.delete(chatConversations).where(conversationFilter);
    await tx.delete(inAppNotifications).where(eq(inAppNotifications.userId, userId));
    await tx.delete(pushTokens).where(eq(pushTokens.userId, userId));
    await tx.delete(couponUsage).where(eq(couponUsage.userId, userId));
    await tx.delete(listings).where(eq(listings.sellerId, userId));
    await tx.delete(userSubscriptions).where(eq(userSubscriptions.userId, userId));
    await tx.delete(userStarterCredits).where(eq(userStarterCredits.userId, userId));
    await tx.delete(userActivity).where(eq(userActivity.userId, userId));
  });

  removeUserProfile(userId);
  return impact;
}

export async function deleteUserDataByAdmin(userId: string): Promise<UserDeletionImpact> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('userId is required');
  }

  const impact = await hardDeleteUserData(normalizedUserId);
  await db.delete(userDeletionReviews).where(eq(userDeletionReviews.userId, normalizedUserId));
  return impact;
}

export async function processApprovedUserDeletions(options?: {
  limit?: number;
  dryRun?: boolean;
}): Promise<{
  scanned: number;
  deleted: number;
  failed: number;
  dryRun: boolean;
  results: Array<{
    reviewId: string;
    userId: string;
    status: 'deleted' | 'failed' | 'dry-run';
    impact: UserDeletionImpact;
    error?: string;
  }>;
}> {
  const limit = Math.max(1, Math.min(500, Number(options?.limit || 100)));
  const dryRun = Boolean(options?.dryRun);

  const approvedRows = await db
    .select()
    .from(userDeletionReviews)
    .where(eq(userDeletionReviews.status, 'approved'))
    .orderBy(asc(userDeletionReviews.reviewedAt), asc(userDeletionReviews.createdAt))
    .limit(limit);

  const results: Array<{
    reviewId: string;
    userId: string;
    status: 'deleted' | 'failed' | 'dry-run';
    impact: UserDeletionImpact;
    error?: string;
  }> = [];
  let deleted = 0;
  let failed = 0;

  for (const review of approvedRows) {
    let impact: UserDeletionImpact = {
      listings: 0,
      subscriptions: 0,
      starterCredits: 0,
      conversations: 0,
      messages: 0,
      notifications: 0,
      pushTokens: 0,
      couponUsage: 0,
    };
    try {
      impact = await getUserDeletionImpact(review.userId);
      if (dryRun) {
        results.push({
          reviewId: review.id,
          userId: review.userId,
          status: 'dry-run',
          impact,
        });
        continue;
      }

      await hardDeleteUserData(review.userId);
      await db
        .update(userDeletionReviews)
        .set({
          status: 'deleted',
          processedAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(userDeletionReviews.id, review.id));

      deleted++;
      results.push({
        reviewId: review.id,
        userId: review.userId,
        status: 'deleted',
        impact,
      });
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      await db
        .update(userDeletionReviews)
        .set({
          status: 'failed',
          processedAt: new Date(),
          lastError: message,
          updatedAt: new Date(),
        })
        .where(eq(userDeletionReviews.id, review.id));

      results.push({
        reviewId: review.id,
        userId: review.userId,
        status: 'failed',
        impact,
        error: message,
      });
    }
  }

  return {
    scanned: approvedRows.length,
    deleted,
    failed,
    dryRun,
    results,
  };
}
