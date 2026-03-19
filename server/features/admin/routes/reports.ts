import type { Express, Response, Request } from 'express';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../../../data/db';
import { chatConversations, listings } from '../models/admin-settings';
import { users } from '../../users/models/users';
import { transactions } from '../../subscriptions/models/subscription';
import { getReportsByStatus, getTrendingSpamReasons } from '../../users/services/spam-detector';

/**
 * Admin Reports Routes
 * Provides analytics and reporting endpoints
 */

export function registerReportsRoutes(app: Express) {
  const toNumber = (value: unknown): number => {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const trendString = (current: number, previous: number): string => {
    if (previous <= 0) {
      return current > 0 ? '+100.0%' : '+0.0%';
    }
    const pct = ((current - previous) / previous) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

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
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [
        totalUsersRows,
        activeListingsRows,
        totalTransactionsRows,
        totalRevenueRows,
        currentUsersRows,
        previousUsersRows,
        currentListingsRows,
        previousListingsRows,
        currentTransactionsRows,
        previousTransactionsRows,
        currentRevenueRows,
        previousRevenueRows,
        monthlyUsersRows,
        monthlyListingsRows,
        categoryRows,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(users),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(listings)
          .where(and(eq(listings.isActive, true), eq(listings.status, 'active'))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(eq(transactions.paymentStatus, 'completed')),
        db
          .select({ total: sql<number>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)` })
          .from(transactions)
          .where(eq(transactions.paymentStatus, 'completed')),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(gte(users.createdAt, currentMonthStart)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(and(gte(users.createdAt, previousMonthStart), lt(users.createdAt, currentMonthStart))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(listings)
          .where(gte(listings.createdAt, currentMonthStart)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(listings)
          .where(
            and(gte(listings.createdAt, previousMonthStart), lt(listings.createdAt, currentMonthStart))
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(
            and(
              eq(transactions.paymentStatus, 'completed'),
              gte(transactions.createdAt, currentMonthStart),
              lt(transactions.createdAt, nextMonthStart)
            )
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(
            and(
              eq(transactions.paymentStatus, 'completed'),
              gte(transactions.createdAt, previousMonthStart),
              lt(transactions.createdAt, currentMonthStart)
            )
          ),
        db
          .select({ total: sql<number>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.paymentStatus, 'completed'),
              gte(transactions.createdAt, currentMonthStart),
              lt(transactions.createdAt, nextMonthStart)
            )
          ),
        db
          .select({ total: sql<number>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.paymentStatus, 'completed'),
              gte(transactions.createdAt, previousMonthStart),
              lt(transactions.createdAt, currentMonthStart)
            )
          ),
        db
          .select({
            key: sql<string>`to_char(date_trunc('month', ${users.createdAt}), 'YYYY-MM')`,
            month: sql<string>`to_char(date_trunc('month', ${users.createdAt}), 'Mon')`,
            count: sql<number>`count(*)::int`,
          })
          .from(users)
          .where(gte(users.createdAt, sixMonthsAgo))
          .groupBy(sql`date_trunc('month', ${users.createdAt})`)
          .orderBy(sql`date_trunc('month', ${users.createdAt}) asc`),
        db
          .select({
            key: sql<string>`to_char(date_trunc('month', ${listings.createdAt}), 'YYYY-MM')`,
            month: sql<string>`to_char(date_trunc('month', ${listings.createdAt}), 'Mon')`,
            count: sql<number>`count(*)::int`,
          })
          .from(listings)
          .where(gte(listings.createdAt, sixMonthsAgo))
          .groupBy(sql`date_trunc('month', ${listings.createdAt})`)
          .orderBy(sql`date_trunc('month', ${listings.createdAt}) asc`),
        db
          .select({
            name: listings.category,
            value: sql<number>`count(*)::int`,
          })
          .from(listings)
          .where(and(eq(listings.isActive, true), eq(listings.status, 'active')))
          .groupBy(listings.category)
          .orderBy(sql`count(*) desc`)
          .limit(6),
      ]);

      const totalUsers = toNumber(totalUsersRows[0]?.count);
      const activeListings = toNumber(activeListingsRows[0]?.count);
      const totalTransactions = toNumber(totalTransactionsRows[0]?.count);
      const revenue = toNumber(totalRevenueRows[0]?.total);

      const currentUsers = toNumber(currentUsersRows[0]?.count);
      const previousUsers = toNumber(previousUsersRows[0]?.count);
      const currentListings = toNumber(currentListingsRows[0]?.count);
      const previousListings = toNumber(previousListingsRows[0]?.count);
      const currentTransactions = toNumber(currentTransactionsRows[0]?.count);
      const previousTransactions = toNumber(previousTransactionsRows[0]?.count);
      const currentRevenue = toNumber(currentRevenueRows[0]?.total);
      const previousRevenue = toNumber(previousRevenueRows[0]?.total);

      const usersByKey = new Map(
        monthlyUsersRows.map((row) => [
          String(row.key),
          { month: String(row.month), users: toNumber(row.count) },
        ])
      );
      const listingsByKey = new Map(
        monthlyListingsRows.map((row) => [
          String(row.key),
          { month: String(row.month), listings: toNumber(row.count) },
        ])
      );

      const keys = [...new Set([...usersByKey.keys(), ...listingsByKey.keys()])].sort();
      const chartData = keys.map((key) => {
        const usersRow = usersByKey.get(key);
        const listingsRow = listingsByKey.get(key);
        return {
          name: usersRow?.month || listingsRow?.month || key,
          users: usersRow?.users || 0,
          listings: listingsRow?.listings || 0,
        };
      });

      const normalizedCategoryData = categoryRows.map((row) => ({
        name: String(row.name || 'Other'),
        value: toNumber(row.value),
      }));

      res.json({
        success: true,
        totalUsers,
        usersTrend: trendString(currentUsers, previousUsers),
        activeListings,
        listingsTrend: trendString(currentListings, previousListings),
        totalTransactions,
        transactionsTrend: trendString(currentTransactions, previousTransactions),
        revenue,
        revenueTrend: trendString(currentRevenue, previousRevenue),
        chartData,
        categoryData: normalizedCategoryData,
        data: {
          totalUsers,
          usersTrend: trendString(currentUsers, previousUsers),
          activeListings,
          listingsTrend: trendString(currentListings, previousListings),
          totalTransactions,
          transactionsTrend: trendString(currentTransactions, previousTransactions),
          revenue,
          revenueTrend: trendString(currentRevenue, previousRevenue),
          chartData,
          categoryData: normalizedCategoryData,
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
      const [topListingsRows, topCategoriesRows, avgViewsRows] = await Promise.all([
        db
          .select({
            id: listings.id,
            title: listings.title,
            category: listings.category,
            views: listings.viewCount,
          })
          .from(listings)
          .where(and(eq(listings.isActive, true), eq(listings.status, 'active')))
          .orderBy(desc(listings.viewCount), desc(listings.createdAt))
          .limit(5),
        db
          .select({
            category: listings.category,
            count: sql<number>`count(*)::int`,
          })
          .from(listings)
          .where(and(eq(listings.isActive, true), eq(listings.status, 'active')))
          .groupBy(listings.category)
          .orderBy(sql`count(*) desc`)
          .limit(6),
        db
          .select({
            avgViews: sql<number>`coalesce(avg(${listings.viewCount}), 0)`,
          })
          .from(listings)
          .where(and(eq(listings.isActive, true), eq(listings.status, 'active'))),
      ]);

      const topListings = topListingsRows.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        views: toNumber(row.views),
      }));

      const topCategories = topCategoriesRows.map((row) => ({
        category: row.category,
        count: toNumber(row.count),
      }));

      res.json({
        success: true,
        topListings,
        topCategories,
        data: {
          title: 'Listing Performance',
          topListings,
          topCategories,
          summary: {
            avgViewsPerListing: Math.round(toNumber(avgViewsRows[0]?.avgViews)),
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
      const [txRows, summaryRows] = await Promise.all([
        db
          .select({
            id: transactions.id,
            amount: transactions.amount,
            status: transactions.paymentStatus,
            sellerId: transactions.sellerId,
            createdAt: transactions.createdAt,
          })
          .from(transactions)
          .orderBy(desc(transactions.createdAt))
          .limit(20),
        db
          .select({
            totalRevenue: sql<number>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)`,
            totalTransactions: sql<number>`count(*)::int`,
            avgTransactionValue: sql<number>`coalesce(avg(cast(${transactions.amount} as numeric)), 0)`,
          })
          .from(transactions)
          .where(eq(transactions.paymentStatus, 'completed')),
      ]);

      const normalizedTransactions = txRows.map((row) => ({
        id: row.id,
        amount: toNumber(row.amount),
        status: row.status,
        sellerId: row.sellerId,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      }));

      const summary = {
        totalRevenue: toNumber(summaryRows[0]?.totalRevenue),
        totalTransactions: toNumber(summaryRows[0]?.totalTransactions),
        avgTransactionValue: toNumber(summaryRows[0]?.avgTransactionValue),
      };

      res.json({
        success: true,
        transactions: normalizedTransactions,
        summary,
        data: {
          title: 'Transaction Report',
          transactions: normalizedTransactions,
          summary,
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
      const [pendingListingsRows, rejectedListingsRows, chatRows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(listings)
          .where(eq(listings.status, 'pending')),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(listings)
          .where(eq(listings.status, 'rejected')),
        db.select({ count: sql<number>`count(*)::int` }).from(chatConversations),
      ]);

      const pendingUserReports = getReportsByStatus('pending').length;
      const reviewedUserReports =
        getReportsByStatus('reviewed').length + getReportsByStatus('dismissed').length;
      const trendingReasons = getTrendingSpamReasons();

      const pendingListings = toNumber(pendingListingsRows[0]?.count);
      const rejectedListings = toNumber(rejectedListingsRows[0]?.count);
      const reports = [
        ...trendingReasons.map((entry) => ({
          category: entry.reason,
          count: entry.count,
          action: 'Pending review',
        })),
        { category: 'Pending Listings', count: pendingListings, action: 'Review needed' },
        { category: 'Rejected Listings', count: rejectedListings, action: 'Already actioned' },
      ].filter((entry) => entry.count > 0);

      res.json({
        success: true,
        reports,
        data: {
          title: 'Content Moderation',
          reports,
          summary: {
            pendingReports: pendingUserReports + pendingListings,
            resolvedReports: reviewedUserReports + rejectedListings,
            avgResolutionTime: 0,
            chatConversations: toNumber(chatRows[0]?.count),
          },
        },
      });
    } catch (error) {
      console.error('[Reports] Error fetching moderation report:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch moderation report' });
    }
  });

  /**
   * GET /api/admin/revenue
   * Revenue snapshot and monthly trend
   */
  app.get('/api/admin/revenue', async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const [summaryRows, currentRows, previousRows, monthlyRows] = await Promise.all([
        db
          .select({
            totalRevenue: sql<number>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)`,
          })
          .from(transactions)
          .where(eq(transactions.paymentStatus, 'completed')),
        db
          .select({
            totalRevenue: sql<number>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.paymentStatus, 'completed'),
              gte(transactions.createdAt, currentMonthStart)
            )
          ),
        db
          .select({
            totalRevenue: sql<number>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.paymentStatus, 'completed'),
              gte(transactions.createdAt, previousMonthStart),
              lt(transactions.createdAt, currentMonthStart)
            )
          ),
        db
          .select({
            key: sql<string>`to_char(date_trunc('month', ${transactions.createdAt}), 'YYYY-MM')`,
            month: sql<string>`to_char(date_trunc('month', ${transactions.createdAt}), 'Mon')`,
            revenue: sql<number>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)`,
          })
          .from(transactions)
          .where(and(eq(transactions.paymentStatus, 'completed'), gte(transactions.createdAt, sixMonthsAgo)))
          .groupBy(sql`date_trunc('month', ${transactions.createdAt})`)
          .orderBy(sql`date_trunc('month', ${transactions.createdAt}) asc`),
      ]);

      const totalRevenue = toNumber(summaryRows[0]?.totalRevenue);
      const currentRevenue = toNumber(currentRows[0]?.totalRevenue);
      const previousRevenue = toNumber(previousRows[0]?.totalRevenue);
      const transactionFees = 0;
      const subscriptionRevenue = totalRevenue - transactionFees;

      const monthlyData = monthlyRows.map((row) => ({
        key: String(row.key),
        month: String(row.month),
        revenue: toNumber(row.revenue),
        subscriptionRevenue: toNumber(row.revenue),
        transactionFees: 0,
      }));

      const totalTrend = trendString(currentRevenue, previousRevenue);
      const subscriptionPercent = totalRevenue > 0 ? (subscriptionRevenue / totalRevenue) * 100 : 0;
      const transactionPercent = totalRevenue > 0 ? (transactionFees / totalRevenue) * 100 : 0;

      res.json({
        success: true,
        totalRevenue,
        subscriptionRevenue,
        transactionFees,
        totalTrend,
        subscriptionPercent,
        transactionPercent,
        monthlyData,
        data: {
          totalRevenue,
          subscriptionRevenue,
          transactionFees,
          totalTrend,
          subscriptionPercent,
          transactionPercent,
          monthlyData,
        },
      });
    } catch (error) {
      console.error('[Reports] Error fetching revenue report:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch revenue report' });
    }
  });
}
