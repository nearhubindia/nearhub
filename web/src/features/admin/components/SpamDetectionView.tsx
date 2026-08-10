import { useState } from 'react';
import { AlertTriangle, CheckCircle, Eye, XCircle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { useSpamReports, useSpamTrends, useReviewSpamReport } from '@/features/admin/hooks';
import AdminActionMenu from './AdminActionMenu';

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
  const reports: SpamRow[] =
    filter === 'pending'
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

  const columns: ColumnDef<SpamRow>[] = [
    {
      id: 'primary',
      header: filter === 'pending' ? 'Report ID' : 'Reason',
      enableColumnFilter: true,
      accessorFn: (row) => String(filter === 'pending' ? row.id || '' : row.reason || ''),
      meta: { filterPlaceholder: 'Filter value...' },
      cell: ({ row }) => (
        <span className="font-medium text-slate-900">
          {filter === 'pending' ? row.original.id || '-' : row.original.reason || '-'}
        </span>
      ),
    },
    {
      id: 'secondary',
      header: filter === 'pending' ? 'User' : 'Count',
      enableColumnFilter: true,
      accessorFn: (row) =>
        String(filter === 'pending' ? row.reportedUserId || '' : (row.count ?? '')),
      meta: { filterPlaceholder: 'Filter user/count...' },
      cell: ({ row }) => (
        <span className="text-slate-600">
          {filter === 'pending' ? row.original.reportedUserId || '-' : (row.original.count ?? '-')}
        </span>
      ),
    },
    {
      accessorKey: 'timestamp',
      header: 'Date',
      enableColumnFilter: true,
      meta: { filterPlaceholder: 'Filter date...' },
      cell: ({ row }) =>
        row.original.timestamp ? new Date(row.original.timestamp).toLocaleDateString() : 'N/A',
    },
    {
      id: 'action',
      header: 'Action',
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      accessorFn: () => '',
      cell: ({ row }) => (
        <AdminActionMenu
          label="Spam report actions"
          items={
            filter === 'pending'
              ? [
                  {
                    label: 'Approve',
                    icon: <CheckCircle size={15} />,
                    onSelect: () => void handleReview(row.original.id as string, 'approve'),
                    disabled: reviewSpam.isPending,
                  },
                  {
                    label: 'Reject',
                    icon: <XCircle size={15} />,
                    tone: 'danger' as const,
                    onSelect: () => void handleReview(row.original.id as string, 'reject'),
                    disabled: reviewSpam.isPending,
                  },
                ]
              : [
                  {
                    label: 'View only',
                    icon: <Eye size={15} />,
                    onSelect: () => undefined,
                    disabled: true,
                  },
                ]
          }
        />
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-teal-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex items-center">
            <XCircle className="mr-2 h-5 w-5" />
            Error loading spam data. Please try again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white sm:p-6">
        <h1 className="mb-2 text-3xl font-black sm:text-4xl">
          <AlertTriangle className="mr-2 inline-block h-8 w-8" />
          Spam Detection
        </h1>
        <p className="text-slate-300">Monitor and review spam reports and trending violations.</p>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap gap-2 sm:gap-4">
          {['pending', 'trending'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab as 'pending' | 'trending')}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition sm:px-6 ${
                filter === tab
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                  : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
              }`}
              type="button"
            >
              {tab === 'pending' ? 'Pending Reports' : 'Trending Reasons'}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={reports}
          searchPlaceholder={
            filter === 'pending' ? 'Search pending reports...' : 'Search trends...'
          }
        />
      </div>
    </div>
  );
}
