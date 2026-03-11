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
import { Users, FileText, BarChart3, TrendingUp } from 'lucide-react';
import { chartData, categoryData, COLORS } from '@/features/admin/constants/admin-constants';
import { useGrowthReport, useRecentActivity } from '@/features/admin/hooks';
import type { Stat } from '@/features/admin/types/admin-types';

export default function DashboardView() {
  const { data: reportData, isLoading } = useGrowthReport();
  const { data: recentActivityData } = useRecentActivity();

  const formatRelativeTime = (timestamp?: string | null): string => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Just now';
    const diffMs = Date.now() - date.getTime();
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
      value: (reportData?.totalUsers || 0).toLocaleString(),
      icon: Users,
      trend: reportData?.usersTrend || '+0%',
    },
    {
      label: 'Active Listings',
      value: (reportData?.activeListings || 0).toLocaleString(),
      icon: FileText,
      trend: reportData?.listingsTrend || '+0%',
    },
    {
      label: 'Total Transactions',
      value: (reportData?.totalTransactions || 0).toLocaleString(),
      icon: BarChart3,
      trend: reportData?.transactionsTrend || '+0%',
    },
    {
      label: 'Revenue',
      value: `₹${(reportData?.revenue || 0).toLocaleString()}`,
      icon: TrendingUp,
      trend: reportData?.revenueTrend || '+0%',
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
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 border-b border-slate-700">
        <h1 className="text-4xl font-black mb-2">Dashboard</h1>
        <p className="text-slate-300">Welcome back! Here's your platform overview.</p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
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
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
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
          </div>

          {/* Category Distribution */}
          <div className="bg-white rounded-lg p-6 border border-slate-200 hover:shadow-lg transition">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Category Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
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
                  className="flex items-center justify-between py-3 border-b last:border-0 last:pb-0"
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
