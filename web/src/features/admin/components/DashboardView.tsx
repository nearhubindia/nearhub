import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { useEffect, useState } from 'react';
import { Users, FileText, BarChart3, TrendingUp } from 'lucide-react';
import { COLORS } from '@/features/admin/constants/admin-constants';
import {
  useGrowthReport,
  useRecentActivity,
  useDashboardStats,
  useUsers,
} from '@/features/admin/hooks';
import type { Stat } from '@/features/admin/types/admin-types';

interface GrowthChartPoint {
  name: string;
  users: number;
  listings: number;
}

interface CategoryChartPoint {
  name: string;
  value: number;
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
  categoryData?: CategoryChartPoint[];
}

function unwrapData<T>(payload: unknown): T | undefined {
  if (!payload) return undefined;
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data?: T }).data;
  }
  return payload as T;
}

export default function DashboardView() {
  const { data: reportData, isLoading } = useGrowthReport();
  const { data: recentActivityData } = useRecentActivity();
  const { data: dashboardStatsData } = useDashboardStats();
  const { data: usersData } = useUsers();
  const [nowTimestamp, setNowTimestamp] = useState(0);
  const growthData = unwrapData<GrowthData>(reportData) ?? {};
  const usersTotalFromUsersPage = Number(
    usersData?.total ?? (Array.isArray(usersData?.data) ? usersData.data.length : 0)
  );
  const dashboardStats = (
    dashboardStatsData &&
    typeof dashboardStatsData === 'object' &&
    'stats' in dashboardStatsData &&
    dashboardStatsData.stats &&
    typeof dashboardStatsData.stats === 'object'
      ? dashboardStatsData.stats
      : {}
  ) as { totalUsers?: number; activeListings?: number };

  const resolvedTotalUsers = Math.max(
    Number(growthData?.totalUsers ?? 0),
    Number(usersTotalFromUsersPage ?? 0),
    Number(dashboardStats.totalUsers ?? 0)
  );
  const resolvedActiveListings = Math.max(
    Number(growthData?.activeListings ?? 0),
    Number(dashboardStats.activeListings ?? 0)
  );
  const chartSeries = Array.isArray(growthData?.chartData) ? growthData.chartData : [];
  const categorySeries = Array.isArray(growthData?.categoryData) ? growthData.categoryData : [];

  useEffect(() => {
    const refreshNow = () => setNowTimestamp(Date.now());
    refreshNow();
    const intervalId = window.setInterval(refreshNow, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  const formatRelativeTime = (timestamp?: string | null): string => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Just now';
    const diffMs = nowTimestamp - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  const activities = Array.isArray(recentActivityData?.activities)
    ? recentActivityData.activities
    : [];

  const stats: Stat[] = [
    {
      label: 'Total Users',
      value: resolvedTotalUsers.toLocaleString(),
      icon: Users,
      trend: String(growthData?.usersTrend || '+0%'),
    },
    {
      label: 'Active Listings',
      value: resolvedActiveListings.toLocaleString(),
      icon: FileText,
      trend: String(growthData?.listingsTrend || '+0%'),
    },
    {
      label: 'Total Transactions',
      value: Number(growthData?.totalTransactions || 0).toLocaleString(),
      icon: BarChart3,
      trend: String(growthData?.transactionsTrend || '+0%'),
    },
    {
      label: 'Revenue',
      value: `₹${Number(growthData?.revenue || 0).toLocaleString()}`,
      icon: TrendingUp,
      trend: String(growthData?.revenueTrend || '+0%'),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
        <h1 className="text-3xl sm:text-4xl font-black mb-2">Dashboard</h1>
        <p className="text-slate-300">Welcome back! Here's your platform overview.</p>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6">
          {stats.map((stat: Stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white rounded-lg p-6 border border-slate-200 hover:shadow-lg transition"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg">
                    <Icon className="text-teal-600" size={28} />
                  </div>
                  <span className="text-green-600 text-sm font-bold bg-green-100 px-3 py-1 rounded-full">
                    {stat.trend}
                  </span>
                </div>
                <p className="text-slate-600 text-sm mb-2">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* User Growth */}
          <div className="lg:col-span-2 bg-white rounded-lg p-6 border border-slate-200 hover:shadow-lg transition">
            <h2 className="text-lg font-bold text-slate-900 mb-4">User & Listing Growth</h2>
            {chartSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartSeries}>
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
              <p className="text-sm text-slate-500">No growth data available yet.</p>
            )}
          </div>

          {/* Category Distribution */}
          <div className="bg-white rounded-lg p-6 border border-slate-200 hover:shadow-lg transition">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Category Distribution</h2>
            {categorySeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categorySeries}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categorySeries.map((_entry: CategoryChartPoint, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No category data available yet.</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 hover:shadow-lg transition">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {activities.length > 0 ? (
              activities.map((activity, i) => (
                <div
                  key={activity.id ?? i}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between border-b last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-slate-900 font-medium">{activity.user || 'Unknown user'}</p>
                    <p className="text-slate-600 text-sm">{activity.action || 'Activity'}</p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No recent activity available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
