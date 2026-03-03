import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useSpamReports, useSpamTrends, useReviewSpamReport } from '@/features/admin/hooks';

interface SpamRow {
  id?: string;
  reason?: string;
  reportedUserId?: string;
  count?: number;
  timestamp?: string;
}

export default function SpamDetectionView() {
  const { data: reportsData, isLoading: reportsLoading, error: reportsError } = useSpamReports();
  const { data: trendsData, isLoading: trendsLoading, error: trendsError } = useSpamTrends();
  const reviewSpam = useReviewSpamReport();

  const [filter, setFilter] = useState<'pending' | 'trending'>('pending');

  const isLoading = filter === 'pending' ? reportsLoading : trendsLoading;
  const error = filter === 'pending' ? reportsError : trendsError;
  const reports: SpamRow[] = filter === 'pending'
    ? Array.isArray(reportsData?.reports)
      ? (reportsData.reports as SpamRow[])
      : []
    : Array.isArray(trendsData?.trends)
      ? (trendsData.trends as SpamRow[])
      : [];

  const handleReview = async (reportId: string, action: 'approve' | 'reject'): Promise<void> => {
    try {
      await reviewSpam.mutateAsync({ reportId, action });
    } catch (error) {
      console.error('Failed to review spam:', error);
      alert('Failed to review spam report');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 mr-2" />
            Error loading spam data. Please try again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 border-b border-slate-700">
        <h1 className="text-4xl font-black mb-2">
          <AlertTriangle className="inline-block mr-2 h-8 w-8" />
          Spam Detection
        </h1>
        <p className="text-slate-300">Monitor and review spam reports and trending violations.</p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
      <div className="flex gap-4 mb-6">
        {['pending', 'trending'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab as 'pending' | 'trending')}
            className={`px-6 py-2 rounded-lg font-bold transition ${
              filter === tab
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
            }`}
          >
            {tab === 'pending' ? 'Pending Reports' : 'Trending Reasons'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-slate-100 to-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                {filter === 'pending' ? 'Report ID' : 'Reason'}
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                {filter === 'pending' ? 'User' : 'Count'}
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reports.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-slate-500">
                  No {filter} reports found
                </td>
              </tr>
            ) : (
              reports.map((item, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {(item.id as string) || (item.reason as string)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {(item.reportedUserId as string) || (item.count as number)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {item.timestamp
                      ? new Date(item.timestamp as string).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {filter === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(item.id as string, 'approve')}
                          disabled={reviewSpam.isPending}
                          className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReview(item.id as string, 'reject')}
                          disabled={reviewSpam.isPending}
                          className="inline-flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </button>
                      </div>
                    )}
                    {filter === 'trending' && (
                      <span className="text-slate-500 text-xs">View only</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
