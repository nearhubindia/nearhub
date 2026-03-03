import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { chartData } from '@/features/admin/constants/admin-constants';
import { useRevenueStats } from '@/features/admin/hooks';

export default function RevenueView() {
  const { data: revenueData, isLoading } = useRevenueStats();

  const stats = {
    total: revenueData?.totalRevenue || 0,
    subscription: revenueData?.subscriptionRevenue || 0,
    transaction: revenueData?.transactionFees || 0,
    totalTrend: revenueData?.totalTrend || '+0%',
    subscriptionPercent: revenueData?.subscriptionPercent || 0,
    transactionPercent: revenueData?.transactionPercent || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 border-b border-slate-700">
        <h1 className="text-4xl font-black mb-2">Revenue Analytics</h1>
        <p className="text-slate-300">Track your platform earnings</p>
      </div>

      <div className="p-6">
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
            <p className="text-slate-600 text-sm mb-2">Total Revenue</p>
            <p className="text-4xl font-black text-green-600">₹{stats.total.toLocaleString()}</p>
            <p className="text-sm text-green-600 mt-2">{stats.totalTrend} from last month</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-6">
            <p className="text-slate-600 text-sm mb-2">Subscription Revenue</p>
            <p className="text-4xl font-black text-blue-600">
              ₹{stats.subscription.toLocaleString()}
            </p>
            <p className="text-sm text-blue-600 mt-2">
              {stats.subscriptionPercent.toFixed(1)}% of total
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
            <p className="text-slate-600 text-sm mb-2">Transaction Fees</p>
            <p className="text-4xl font-black text-purple-600">
              ₹{stats.transaction.toLocaleString()}
            </p>
            <p className="text-sm text-purple-600 mt-2">
              {stats.transactionPercent.toFixed(1)}% of total
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="users" fill="#0D9488" name="User Signups" />
              <Bar dataKey="listings" fill="#0F766E" name="Listings Posted" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
