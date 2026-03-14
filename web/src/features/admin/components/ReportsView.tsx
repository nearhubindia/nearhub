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
import {
  useGrowthReport,
  usePerformanceReport,
  useTransactionReport,
  useModerationReport,
} from '@/features/admin/hooks';

export default function ReportsView() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const { isLoading: growthLoading } = useGrowthReport();
  const { isLoading: performanceLoading } = usePerformanceReport();
  const { isLoading: transactionLoading } = useTransactionReport();
  const { isLoading: moderationLoading } = useModerationReport();

  const isAnyLoading =
    growthLoading || performanceLoading || transactionLoading || moderationLoading;

  const reports = [
    {
      id: 'growth',
      title: 'User Growth Report',
      desc: 'Monthly user acquisition trends',
      icon: '📈',
    },
    {
      id: 'performance',
      title: 'Listing Performance',
      desc: 'Top performing listings and categories',
      icon: '⭐',
    },
    {
      id: 'transactions',
      title: 'Transaction Report',
      desc: 'All transactions and conversions',
      icon: '💳',
    },
    {
      id: 'moderation',
      title: 'Content Moderation',
      desc: 'Flagged and removed content',
      icon: '🚨',
    },
  ];

  const userGrowthData = [
    { month: 'Jan', total: 500, free: 450, paid: 50 },
    { month: 'Feb', total: 1200, free: 950, paid: 250 },
    { month: 'Mar', total: 2100, free: 1500, paid: 600 },
    { month: 'Apr', total: 3450, free: 2200, paid: 1250 },
    { month: 'May', total: 5600, free: 3100, paid: 2500 },
    { month: 'Jun', total: 8234, free: 4234, paid: 4000 },
  ];

  const topListings = [
    { title: 'iPhone 15 Pro', category: 'Electronics', views: 12450, saves: 2340, inquiries: 156 },
    {
      title: '3BHK Apartment Mumbai',
      category: 'Real Estate',
      views: 9876,
      saves: 1230,
      inquiries: 98,
    },
    { title: 'Honda Civic 2023', category: 'Vehicles', views: 8765, saves: 945, inquiries: 67 },
    {
      title: 'Web Development Service',
      category: 'Services',
      views: 7654,
      saves: 834,
      inquiries: 54,
    },
    { title: 'Senior Software Engineer', category: 'Jobs', views: 6543, saves: 720, inquiries: 45 },
  ];

  const transactionData = [
    { month: 'Jan', revenue: 12000, subscriptions: 8000, featured: 4000 },
    { month: 'Feb', revenue: 25000, subscriptions: 16000, featured: 9000 },
    { month: 'Mar', revenue: 42000, subscriptions: 28000, featured: 14000 },
    { month: 'Apr', revenue: 65000, subscriptions: 42000, featured: 23000 },
    { month: 'May', revenue: 95000, subscriptions: 62000, featured: 33000 },
    { month: 'Jun', revenue: 145000, subscriptions: 95000, featured: 50000 },
  ];

  const moderationData = [
    { category: 'Spam', count: 234, action: 'Removed' },
    { category: 'Inappropriate Content', count: 156, action: 'Flagged' },
    { category: 'Duplicate Listings', count: 89, action: 'Merged' },
    { category: 'Expired Listings', count: 342, action: 'Archived' },
    { category: 'User Reports', count: 56, action: 'Under Review' },
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
          <p className="text-slate-300">Monthly user acquisition and subscription growth trends</p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Total Users (Jun)</p>
              <p className="text-4xl font-black text-blue-600">8,234</p>
              <p className="text-sm text-blue-600 mt-2">+47.2% from May</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Free Tier Users</p>
              <p className="text-4xl font-black text-green-600">4,234</p>
              <p className="text-sm text-green-600 mt-2">51.4% of total</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Paid Subscribers</p>
              <p className="text-4xl font-black text-purple-600">4,000</p>
              <p className="text-sm text-purple-600 mt-2">+60% from May</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">User Growth Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="free"
                  stroke="#10b981"
                  name="Free Users"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="paid"
                  stroke="#8b5cf6"
                  name="Paid Users"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Monthly Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Month</th>
                    <th className="px-4 py-3 text-left font-bold">Total Users</th>
                    <th className="px-4 py-3 text-left font-bold">Free Users</th>
                    <th className="px-4 py-3 text-left font-bold">Paid Users</th>
                    <th className="px-4 py-3 text-left font-bold">Growth Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {userGrowthData.map((row, i) => (
                    <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{row.month}</td>
                      <td className="px-4 py-3">{row.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-green-600 font-bold">
                        {row.free.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-purple-600 font-bold">
                        {row.paid.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-blue-600 font-bold">
                        {i === 0
                          ? '-'
                          : `+${Math.round(((userGrowthData[i].total - userGrowthData[i - 1].total) / userGrowthData[i - 1].total) * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedReport === 'performance') {
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
          <p className="text-slate-300">Top performing listings by views, saves, and inquiries</p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Total Views</p>
              <p className="text-4xl font-black text-blue-600">45.3K</p>
              <p className="text-sm text-blue-600 mt-2">+23.5% from last month</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Total Saves</p>
              <p className="text-4xl font-black text-green-600">5.1K</p>
              <p className="text-sm text-green-600 mt-2">+31.2% from last month</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Total Inquiries</p>
              <p className="text-4xl font-black text-orange-600">420</p>
              <p className="text-sm text-orange-600 mt-2">+18.9% from last month</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Top 5 Performing Listings</h2>
            <div className="space-y-3">
              {topListings.map((listing, i) => (
                <div
                  key={i}
                  className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{listing.title}</h3>
                      <p className="text-sm text-slate-600">{listing.category}</p>
                    </div>
                    <span className="bg-blue-100 text-blue-700 text-sm font-bold px-3 py-1 rounded-full">
                      #{i + 1}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                    <div>
                      <p className="text-xs text-slate-600">Views</p>
                      <p className="text-lg font-bold text-blue-600">
                        {listing.views.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Saves</p>
                      <p className="text-lg font-bold text-green-600">
                        {listing.saves.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Inquiries</p>
                      <p className="text-lg font-bold text-orange-600">
                        {listing.inquiries.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedReport === 'transactions') {
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
          <p className="text-slate-300">
            Revenue breakdown by subscription and listing enhancements
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Total Revenue (June)</p>
              <p className="text-4xl font-black text-green-600">₹1,45,000</p>
              <p className="text-sm text-green-600 mt-2">+52.6% from May</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Subscription Revenue</p>
              <p className="text-4xl font-black text-blue-600">₹95,000</p>
              <p className="text-sm text-blue-600 mt-2">65.5% of total</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Enhancement Revenue</p>
              <p className="text-4xl font-black text-purple-600">₹50,000</p>
              <p className="text-sm text-purple-600 mt-2">34.5% of total</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Revenue Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={transactionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="subscriptions" fill="#0D9488" name="Subscriptions" />
                <Bar dataKey="featured" fill="#8b5cf6" name="Featured/Enhancements" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Monthly Revenue Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Month</th>
                    <th className="px-4 py-3 text-left font-bold">Subscriptions</th>
                    <th className="px-4 py-3 text-left font-bold">Enhancements</th>
                    <th className="px-4 py-3 text-left font-bold">Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionData.map((row, i) => (
                    <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{row.month}</td>
                      <td className="px-4 py-3 text-blue-600 font-bold">
                        ₹{row.subscriptions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-purple-600 font-bold">
                        ₹{row.featured.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-green-600">
                        ₹{row.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedReport === 'moderation') {
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
          <p className="text-slate-300">Content flagged, removed, and reviewed by moderators</p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Total Issues</p>
              <p className="text-4xl font-black text-red-600">877</p>
              <p className="text-sm text-red-600 mt-2">This month</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Resolved</p>
              <p className="text-4xl font-black text-green-600">821</p>
              <p className="text-sm text-green-600 mt-2">93.6% resolution rate</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-6">
              <p className="text-slate-600 text-sm mb-2">Pending Review</p>
              <p className="text-4xl font-black text-amber-600">56</p>
              <p className="text-sm text-amber-600 mt-2">Average 2.3 days</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Issues by Category</h2>
            <div className="space-y-3">
              {moderationData.map((item, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-slate-900">{item.category}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        item.action === 'Removed'
                          ? 'bg-red-100 text-red-700'
                          : item.action === 'Flagged'
                            ? 'bg-yellow-100 text-yellow-700'
                            : item.action === 'Merged'
                              ? 'bg-blue-100 text-blue-700'
                              : item.action === 'Archived'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {item.action}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-400 to-orange-400"
                        style={{ width: `${(item.count / 342) * 100}%` }}
                      />
                    </div>
                    <span className="font-bold text-slate-900 min-w-12">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-lg font-bold text-blue-900 mb-4">📋 Recent Moderation Actions</h2>
            <div className="space-y-2 text-sm">
              <p className="text-blue-800">✓ Removed 12 spam listings from Electronics category</p>
              <p className="text-blue-800">✓ Flagged 5 listings with suspicious pricing patterns</p>
              <p className="text-blue-800">✓ Merged 8 duplicate real estate listings</p>
              <p className="text-blue-800">
                ✓ Reviewed 15 user reports about inappropriate content
              </p>
              <p className="text-blue-800">✓ Suspended 2 accounts for repeated policy violations</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: Report Selection View
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
              <span className="text-teal-600 font-bold text-sm">View Report →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
