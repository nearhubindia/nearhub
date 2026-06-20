import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import {
  useGrowthReport,
  usePerformanceReport,
  useTransactionReport,
  useModerationReport,
  useDashboardStats,
  useUsers,
} from '@/features/admin/hooks';

type ReportType = 'growth' | 'performance' | 'transactions' | 'moderation';

interface GrowthChartPoint {
  name: string;
  users: number;
  listings: number;
}

interface CategoryPoint {
  name: string;
  value: number;
}

interface TopListing {
  id?: string;
  title?: string;
  category?: string;
  views?: number;
}

interface TopCategory {
  category: string;
  count: number;
}

interface TransactionRow {
  id?: string;
  sellerId?: string;
  status?: string;
  amount?: number;
  createdAt?: string;
}

interface MonthlyRevenuePoint {
  month: string;
  revenue: number;
}

interface ModerationRow {
  category?: string;
  action?: string;
  count?: number;
}

interface GrowthData {
  totalUsers?: number;
  usersTrend?: string;
  activeListings?: number;
  listingsTrend?: string;
  totalTransactions?: number;
  transactionsTrend?: string;
  revenue?: number;
  revenueTrend?: string;
  chartData?: GrowthChartPoint[];
  categoryData?: CategoryPoint[];
}

interface PerformanceData {
  topListings?: TopListing[];
  topCategories?: TopCategory[];
}

interface TransactionSummary {
  totalRevenue?: number;
  totalTransactions?: number;
  avgTransactionValue?: number;
}

interface TransactionData {
  summary?: TransactionSummary;
  transactions?: TransactionRow[];
  monthlyData?: MonthlyRevenuePoint[];
}

interface ModerationSummary {
  pendingReports?: number;
  resolvedReports?: number;
  chatConversations?: number;
}

interface ModerationData {
  summary?: ModerationSummary;
  reports?: ModerationRow[];
}

function unwrapData<T>(payload: unknown): T | undefined {
  if (!payload) return undefined;
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data?: T }).data;
  }
  return payload as T;
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatRelativeAge(value: number): string {
  if (!value) return 'just now';
  const diffMs = Date.now() - value;
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

export default function ReportsView() {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);

  const {
    data: growthRaw,
    isLoading: growthLoading,
    isFetching: growthFetching,
    dataUpdatedAt: growthUpdatedAt,
  } = useGrowthReport();
  const { data: dashboardStatsRaw } = useDashboardStats();
  const { data: usersData } = useUsers();
  const {
    data: performanceRaw,
    isLoading: performanceLoading,
    isFetching: performanceFetching,
    dataUpdatedAt: performanceUpdatedAt,
  } = usePerformanceReport();
  const {
    data: transactionRaw,
    isLoading: transactionLoading,
    isFetching: transactionFetching,
    dataUpdatedAt: transactionUpdatedAt,
  } = useTransactionReport();
  const {
    data: moderationRaw,
    isLoading: moderationLoading,
    isFetching: moderationFetching,
    dataUpdatedAt: moderationUpdatedAt,
  } = useModerationReport();

  const growth = unwrapData<GrowthData>(growthRaw) ?? {};
  const dashboardStats = (
    dashboardStatsRaw &&
    typeof dashboardStatsRaw === 'object' &&
    'stats' in dashboardStatsRaw &&
    dashboardStatsRaw.stats &&
    typeof dashboardStatsRaw.stats === 'object'
      ? dashboardStatsRaw.stats
      : {}
  ) as { totalUsers?: number; activeListings?: number };
  const performance = unwrapData<PerformanceData>(performanceRaw) ?? {};
  const transaction = unwrapData<TransactionData>(transactionRaw) ?? {};
  const moderation = unwrapData<ModerationData>(moderationRaw) ?? {};
  const usersTotalFromUsersPage = asNumber(
    usersData?.total ?? (Array.isArray(usersData?.data) ? usersData.data.length : 0)
  );

  const resolvedGrowthTotalUsers = Math.max(
    asNumber(growth.totalUsers),
    asNumber(usersTotalFromUsersPage),
    asNumber(dashboardStats.totalUsers)
  );
  const resolvedGrowthActiveListings = Math.max(
    asNumber(growth.activeListings),
    asNumber(dashboardStats.activeListings)
  );

  const growthChartData = Array.isArray(growth.chartData) ? growth.chartData : [];
  const categoryData = Array.isArray(growth.categoryData) ? growth.categoryData : [];
  const topListings = Array.isArray(performance.topListings) ? performance.topListings : [];
  const topCategories = Array.isArray(performance.topCategories) ? performance.topCategories : [];
  const transactions = Array.isArray(transaction.transactions) ? transaction.transactions : [];
  const moderationReports = Array.isArray(moderation.reports) ? moderation.reports : [];

  const monthlyRevenueData = Array.isArray(transaction.monthlyData) ? transaction.monthlyData : [];

  const transactionColumns: ColumnDef<TransactionRow>[] = [
    {
      accessorKey: 'id',
      header: 'Transaction ID',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter transaction...' },
      cell: ({ row }) => (
        <span className="font-mono text-xs">{String(row.original.id || '-')}</span>
      ),
    },
    {
      accessorKey: 'sellerId',
      header: 'Seller',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter seller...' },
      cell: ({ row }) => String(row.original.sellerId || '-'),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter status...' },
      cell: ({ row }) => String(row.original.status || '-'),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter amount...' },
      cell: ({ row }) => `₹${asNumber(row.original.amount).toLocaleString()}`,
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter date...' },
      cell: ({ row }) =>
        row.original.createdAt ? new Date(String(row.original.createdAt)).toLocaleString() : '-',
    },
  ] satisfies ColumnDef<TransactionRow>[];

  const isAnyLoading =
    growthLoading || performanceLoading || transactionLoading || moderationLoading;

  const reports = [
    {
      id: 'growth' as const,
      title: 'User Growth Report',
      desc: 'Monthly user/listing trends',
      icon: '📈',
      updatedAt: growthUpdatedAt,
      refreshing: growthFetching,
    },
    {
      id: 'performance' as const,
      title: 'Listing Performance',
      desc: 'Top listings and categories',
      icon: '⭐',
      updatedAt: performanceUpdatedAt,
      refreshing: performanceFetching,
    },
    {
      id: 'transactions' as const,
      title: 'Transaction Report',
      desc: 'Revenue and payment activity',
      icon: '💳',
      updatedAt: transactionUpdatedAt,
      refreshing: transactionFetching,
    },
    {
      id: 'moderation' as const,
      title: 'Content Moderation',
      desc: 'Pending/resolved moderation issues',
      icon: '🚨',
      updatedAt: moderationUpdatedAt,
      refreshing: moderationFetching,
    },
  ];

  if (isAnyLoading && !selectedReport) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (selectedReport === 'growth') {
    return (
      <div>
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
          <button
            onClick={() => setSelectedReport(null)}
            className="text-teal-400 hover:text-teal-300 mb-4 font-bold"
          >
            ← Back to Reports
          </button>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">📈 User Growth Report</h1>
          <p className="text-slate-300">Live growth metrics from backend</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-950/30 px-2.5 py-1 font-semibold text-slate-200">
              {growthFetching ? 'Refreshing live feed' : 'Live feed ready'}
            </span>
            <span>Last refreshed {formatRelativeAge(growthUpdatedAt)}</span>
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Total Users</p>
              <p className="text-3xl font-black text-blue-600">
                {resolvedGrowthTotalUsers.toLocaleString()}
              </p>
              <p className="text-sm text-blue-600 mt-2">{String(growth.usersTrend || '+0%')}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Active Listings</p>
              <p className="text-3xl font-black text-teal-600">
                {resolvedGrowthActiveListings.toLocaleString()}
              </p>
              <p className="text-sm text-teal-600 mt-2">{String(growth.listingsTrend || '+0%')}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Transactions</p>
              <p className="text-3xl font-black text-amber-600">
                {asNumber(growth.totalTransactions).toLocaleString()}
              </p>
              <p className="text-sm text-amber-600 mt-2">
                {String(growth.transactionsTrend || '+0%')}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Revenue</p>
              <p className="text-3xl font-black text-green-600">
                ₹{asNumber(growth.revenue).toLocaleString()}
              </p>
              <p className="text-sm text-green-600 mt-2">{String(growth.revenueTrend || '+0%')}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Users vs Listings (Monthly)</h2>
            {growthChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={growthChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="#0D9488"
                    name="Users"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="listings"
                    stroke="#0F766E"
                    name="Listings"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No growth chart data available yet.</p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Category Distribution</h2>
            {categoryData.length > 0 ? (
              <div className="space-y-3">
                {categoryData.map((row: CategoryPoint, i: number) => (
                  <div
                    key={`${row.name}-${i}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium text-slate-800">
                      {String(row.name || 'Other')}
                    </span>
                    <span className="font-bold text-slate-900">
                      {asNumber(row.value).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No category distribution data available yet.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selectedReport === 'performance') {
    const totalViews = topListings.reduce(
      (sum: number, item: TopListing) => sum + asNumber(item.views),
      0
    );
    const avgViews = topListings.length > 0 ? Math.round(totalViews / topListings.length) : 0;

    return (
      <div>
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
          <button
            onClick={() => setSelectedReport(null)}
            className="text-teal-400 hover:text-teal-300 mb-4 font-bold"
          >
            ← Back to Reports
          </button>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">⭐ Listing Performance Report</h1>
          <p className="text-slate-300">Live top listings and category performance</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-950/30 px-2.5 py-1 font-semibold text-slate-200">
              {performanceFetching ? 'Refreshing live feed' : 'Live feed ready'}
            </span>
            <span>Last refreshed {formatRelativeAge(performanceUpdatedAt)}</span>
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Top Listings Count</p>
              <p className="text-3xl font-black text-blue-600">{topListings.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Total Views (Top)</p>
              <p className="text-3xl font-black text-green-600">{totalViews.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Avg Views / Listing</p>
              <p className="text-3xl font-black text-purple-600">{avgViews.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Top Listings</h2>
            {topListings.length > 0 ? (
              <div className="space-y-3">
                {topListings.map((listing: TopListing, i: number) => (
                  <div key={listing.id || i} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {String(listing.title || 'Untitled')}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {String(listing.category || 'Other')}
                        </p>
                      </div>
                      <span className="font-bold text-blue-600">
                        {asNumber(listing.views).toLocaleString()} views
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No performance listing data available yet.</p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Top Categories</h2>
            {topCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topCategories}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0D9488" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No category performance data available yet.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selectedReport === 'transactions') {
    const summary = transaction.summary || {};
    return (
      <div>
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
          <button
            onClick={() => setSelectedReport(null)}
            className="text-teal-400 hover:text-teal-300 mb-4 font-bold"
          >
            ← Back to Reports
          </button>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">💳 Transaction Report</h1>
          <p className="text-slate-300">Live transaction and revenue summary</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-950/30 px-2.5 py-1 font-semibold text-slate-200">
              {transactionFetching ? 'Refreshing live feed' : 'Live feed ready'}
            </span>
            <span>Last refreshed {formatRelativeAge(transactionUpdatedAt)}</span>
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Total Revenue</p>
              <p className="text-3xl font-black text-green-600">
                ₹{asNumber(summary.totalRevenue).toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Completed Transactions</p>
              <p className="text-3xl font-black text-blue-600">
                {asNumber(summary.totalTransactions).toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Avg Transaction Value</p>
              <p className="text-3xl font-black text-purple-600">
                ₹{asNumber(summary.avgTransactionValue).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Monthly Revenue Trend</h2>
            {monthlyRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#0D9488" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">
                No monthly transaction trend data available yet.
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Transactions</h2>
            {transactions.length > 0 ? (
              <DataTable
                columns={transactionColumns}
                data={transactions}
                showSearch={false}
                showPagination={false}
              />
            ) : (
              <p className="text-sm text-slate-500">No transactions available.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selectedReport === 'moderation') {
    const summary = moderation.summary || {};
    return (
      <div>
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
          <button
            onClick={() => setSelectedReport(null)}
            className="text-teal-400 hover:text-teal-300 mb-4 font-bold"
          >
            ← Back to Reports
          </button>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">🚨 Content Moderation Report</h1>
          <p className="text-slate-300">Live moderation queues and report trends</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-950/30 px-2.5 py-1 font-semibold text-slate-200">
              {moderationFetching ? 'Refreshing live feed' : 'Live feed ready'}
            </span>
            <span>Last refreshed {formatRelativeAge(moderationUpdatedAt)}</span>
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Pending Reports</p>
              <p className="text-3xl font-black text-amber-600">
                {asNumber(summary.pendingReports).toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Resolved Reports</p>
              <p className="text-3xl font-black text-green-600">
                {asNumber(summary.resolvedReports).toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Chat Conversations</p>
              <p className="text-3xl font-black text-blue-600">
                {asNumber(summary.chatConversations).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Issues by Category</h2>
            {moderationReports.length > 0 ? (
              <div className="space-y-3">
                {moderationReports.map((item: ModerationRow, i: number) => (
                  <div
                    key={`${item.category}-${i}`}
                    className="flex items-center justify-between border border-slate-200 rounded-lg p-4"
                  >
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {String(item.category || 'Other')}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {String(item.action || 'Pending review')}
                      </p>
                    </div>
                    <span className="font-bold text-red-600">
                      {asNumber(item.count).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No moderation issues currently reported.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
        <h1 className="text-3xl sm:text-4xl font-black mb-2">Reports</h1>
        <p className="text-slate-300">View and analyze platform performance reports</p>
      </div>
      <div className="p-4 sm:p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {reports.map((report) => (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report.id)}
              className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-lg transition text-left hover:border-teal-400"
            >
              <div className="text-4xl mb-4">{report.icon}</div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{report.title}</h3>
              <p className="text-slate-600 text-sm mb-4">{report.desc}</p>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                  {report.refreshing ? 'Refreshing live feed' : 'Live feed ready'}
                </span>
                <span>Updated {formatRelativeAge(report.updatedAt)}</span>
              </div>
              <span className="text-teal-600 font-bold text-sm">View Report →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
