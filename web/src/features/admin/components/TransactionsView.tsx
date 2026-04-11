import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { useTransactionReport } from '@/features/admin/hooks';

interface TransactionSummary {
  totalRevenue?: number;
  totalTransactions?: number;
  avgTransactionValue?: number;
}

interface TransactionRow {
  id?: string;
  amount?: number;
  status?: string;
  sellerId?: string;
  createdAt?: string | null;
}

interface TransactionPayload {
  summary?: TransactionSummary;
  transactions?: TransactionRow[];
}

function unwrapData<T>(payload: unknown): T | undefined {
  if (!payload) return undefined;
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data?: T }).data;
  }
  return payload as T;
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

function formatStatus(value: string | undefined): string {
  const status = String(value || 'unknown').toLowerCase();
  if (status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  if (status === 'pending') return 'Pending';
  if (status === 'refunded') return 'Refunded';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function TransactionsView() {
  const { data, isLoading, isFetching, refetch } = useTransactionReport();
  const resolved = unwrapData<TransactionPayload>(data) ?? {};

  const summary = resolved.summary ?? {};
  const transactions = Array.isArray(resolved.transactions) ? resolved.transactions : [];

  const stats = {
    totalRevenue: toNumber(summary.totalRevenue),
    totalTransactions: toNumber(summary.totalTransactions),
    avgTransactionValue: toNumber(summary.avgTransactionValue),
  };

  const columns = useMemo<ColumnDef<TransactionRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Transaction ID',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter transaction...' },
        cell: ({ row }) => <span className="font-mono text-xs text-slate-800">{row.original.id || 'N/A'}</span>,
      },
      {
        accessorKey: 'sellerId',
        header: 'Seller ID',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter seller...' },
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700">{row.original.sellerId || 'N/A'}</span>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        enableColumnFilter: true,
        accessorFn: (tx) => String(tx.amount ?? 0),
        meta: { filterPlaceholder: 'Filter amount...' },
        cell: ({ row }) => (
          <span className="font-semibold text-slate-900">₹{toNumber(row.original.amount).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter status...' },
        cell: ({ row }) => {
          const status = String(row.original.status || '').toLowerCase();
          const statusClass =
            status === 'completed'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'failed'
                ? 'bg-red-100 text-red-700'
                : status === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-700';

          return (
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
              {formatStatus(row.original.status)}
            </span>
          );
        },
      },
      {
        id: 'createdAt',
        header: 'Created At',
        enableColumnFilter: true,
        accessorFn: (tx) => formatDate(tx.createdAt),
        meta: { filterPlaceholder: 'Filter date...' },
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mb-2 text-3xl font-black sm:text-4xl">Transactions</h1>
            <p className="text-slate-300">Payment activity and transaction summary</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 font-semibold text-white transition hover:bg-teal-600"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Total Revenue</p>
            <p className="mt-2 text-3xl font-black text-green-600">
              ₹{stats.totalRevenue.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Total Transactions</p>
            <p className="mt-2 text-3xl font-black text-teal-600">
              {stats.totalTransactions.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Avg Transaction</p>
            <p className="mt-2 text-3xl font-black text-slate-900">
              ₹{stats.avgTransactionValue.toLocaleString()}
            </p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={transactions}
          searchPlaceholder="Search transaction id, seller id, status, amount..."
        />
      </div>
    </div>
  );
}
