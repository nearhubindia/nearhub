import { db } from '../../../data/db';
import {
  listings,
  listingViews,
  chatConversations,
  listingLikes,
  insertListingViewSchema,
  insertListingLikeSchema,
  type InsertListingView,
  type InsertListingLike,
} from '../../admin/models/admin-settings';
import { eq, and, desc, sql, gte, inArray } from 'drizzle-orm';

/**
 * Track a listing view with IP-based deduplication
 * Only counts unique views per IP within 24 hours
 */
export async function trackListingView(
  listingId: string,
  viewerId: string | null,
  ipAddress: string,
  userAgent?: string
): Promise<{ success: boolean; isDuplicate: boolean }> {
  try {
    // Check if this IP viewed this listing in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentView = await db
      .select()
      .from(listingViews)
      .where(
        and(
          eq(listingViews.listingId, listingId),
          eq(listingViews.ipAddress, ipAddress),
          gte(listingViews.viewedAt, oneDayAgo)
        )
      )
      .limit(1);

    // If there's a recent view from this IP, don't count it again
    if (recentView.length > 0) {
      return { success: true, isDuplicate: true };
    }

    // Record the view
    const validated = insertListingViewSchema.parse({
      listingId,
      viewerId,
      ipAddress,
      userAgent,
    });

    await db.insert(listingViews).values(validated as InsertListingView);

    // Increment the listing's view counter
    await db
      .update(listings)
      .set({
        viewCount: sql`${listings.viewCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, listingId));

    return { success: true, isDuplicate: false };
  } catch (error) {
    console.error('[Analytics] Error tracking listing view:', error);
    throw error;
  }
}

/**
 * Get analytics for a specific listing
 */
export async function getListingAnalytics(listingId: string) {
  try {
    const listing = await db
      .select({
        id: listings.id,
        title: listings.title,
        viewCount: listings.viewCount,
        createdAt: listings.createdAt,
      })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);

    if (listing.length === 0) {
      return null;
    }

    // Get view trends (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentViews = await db
      .select({
        date: sql<string>`DATE(${listingViews.viewedAt})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(listingViews)
      .where(and(eq(listingViews.listingId, listingId), gte(listingViews.viewedAt, sevenDaysAgo)))
      .groupBy(sql`DATE(${listingViews.viewedAt})`)
      .orderBy(sql`DATE(${listingViews.viewedAt}) DESC`);

    return {
      listingId: listing[0].id,
      title: listing[0].title,
      totalViews: listing[0].viewCount,
      createdAt: listing[0].createdAt,
      last7Days: recentViews,
    };
  } catch (error) {
    console.error('[Analytics] Error fetching listing analytics:', error);
    throw error;
  }
}

/**
 * Get analytics for all listings of a user
 */
export async function getUserAnalytics(userId: string) {
  try {
    const userListings = await db
      .select({
        id: listings.id,
        title: listings.title,
        viewCount: listings.viewCount,
        status: listings.status,
        createdAt: listings.createdAt,
        expiresAt: listings.expiresAt,
      })
      .from(listings)
      .where(eq(listings.sellerId, userId))
      .orderBy(desc(listings.createdAt));

    // Calculate total views across all listings
    const totalViews = userListings.reduce((sum, listing) => sum + (listing.viewCount || 0), 0);

    // Get top 5 most viewed listings
    const topListings = [...userListings]
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, 5);

    // Get view trends for last 30 days across all user's listings
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const viewTrends = await db
      .select({
        date: sql<string>`DATE(${listingViews.viewedAt})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(listingViews)
      .innerJoin(listings, eq(listingViews.listingId, listings.id))
      .where(and(eq(listings.sellerId, userId), gte(listingViews.viewedAt, thirtyDaysAgo)))
      .groupBy(sql`DATE(${listingViews.viewedAt})`)
      .orderBy(sql`DATE(${listingViews.viewedAt}) DESC`);

    return {
      userId,
      totalListings: userListings.length,
      activeListings: userListings.filter((l) => l.status === 'active').length,
      totalViews,
      averageViewsPerListing:
        userListings.length > 0 ? Math.round(totalViews / userListings.length) : 0,
      topListings,
      allListings: userListings,
      last30DaysViews: viewTrends,
    };
  } catch (error) {
    console.error('[Analytics] Error fetching user analytics:', error);
    throw error;
  }
}

export const getSellerAnalytics = getUserAnalytics;

/**
 * Get chat conversation counts grouped by listing id.
 */
export async function getListingConversationCountMap(
  listingIds: string[]
): Promise<Map<string, number>> {
  const normalizedIds = [
    ...new Set(listingIds.map((id) => String(id || '').trim()).filter(Boolean)),
  ];

  if (normalizedIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      listingId: chatConversations.listingId,
      chatCount: sql<number>`COUNT(*)::int`,
    })
    .from(chatConversations)
    .where(inArray(chatConversations.listingId, normalizedIds))
    .groupBy(chatConversations.listingId);

  const chatCountMap = new Map<string, number>();
  normalizedIds.forEach((id) => chatCountMap.set(id, 0));

  rows.forEach((row) => {
    const listingId = String(row.listingId || '').trim();
    if (!listingId) return;
    chatCountMap.set(listingId, Number(row.chatCount) || 0);
  });

  return chatCountMap;
}

/**
 * Get like/save counts grouped by listing id.
 */
export async function getListingLikeCountMap(listingIds: string[]): Promise<Map<string, number>> {
  const normalizedIds = [
    ...new Set(listingIds.map((id) => String(id || '').trim()).filter(Boolean)),
  ];

  if (normalizedIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      listingId: listingLikes.listingId,
      likeCount: sql<number>`COUNT(*)::int`,
    })
    .from(listingLikes)
    .where(inArray(listingLikes.listingId, normalizedIds))
    .groupBy(listingLikes.listingId);

  const likeCountMap = new Map<string, number>();
  normalizedIds.forEach((id) => likeCountMap.set(id, 0));

  rows.forEach((row) => {
    const listingId = String(row.listingId || '').trim();
    if (!listingId) return;
    likeCountMap.set(listingId, Number(row.likeCount) || 0);
  });

  return likeCountMap;
}

export async function setListingLike(
  listingId: string,
  userId: string,
  liked: boolean
): Promise<{ liked: boolean; likeCount: number }> {
  const normalizedListingId = String(listingId || '').trim();
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedListingId || !normalizedUserId) {
    return { liked: false, likeCount: 0 };
  }

  if (liked) {
    const payload = insertListingLikeSchema.parse({
      listingId: normalizedListingId,
      userId: normalizedUserId,
    });

    await db
      .insert(listingLikes)
      .values(payload as InsertListingLike)
      .onConflictDoNothing({
        target: [listingLikes.listingId, listingLikes.userId],
      });
  } else {
    await db
      .delete(listingLikes)
      .where(
        and(
          eq(listingLikes.listingId, normalizedListingId),
          eq(listingLikes.userId, normalizedUserId)
        )
      );
  }

  const likeCountRows = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(listingLikes)
    .where(eq(listingLikes.listingId, normalizedListingId));

  return {
    liked,
    likeCount: Number(likeCountRows[0]?.count || 0),
  };
}

/**
 * Get view milestones for notifications
 * Returns milestones reached (100, 500, 1000, 5000, 10000)
 */
export function getViewMilestones(previousCount: number, currentCount: number): number[] {
  const milestones = [100, 500, 1000, 5000, 10000, 50000, 100000];
  const reached: number[] = [];

  for (const milestone of milestones) {
    if (previousCount < milestone && currentCount >= milestone) {
      reached.push(milestone);
    }
  }

  return reached;
}
