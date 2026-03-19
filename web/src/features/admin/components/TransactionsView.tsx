import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
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

  const stats = useMemo(
    () => ({
      totalRevenue: toNumber(summary.totalRevenue),
      totalTransactions: toNumber(summary.totalTransactions),
      avgTransactionValue: toNumber(summary.avgTransactionValue),
    }),
    [summary.avgTransactionValue, summary.totalRevenue, summary.totalTransactions]
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-teal-500"></div>
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

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">Recent Transactions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Transaction ID
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Seller ID
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                      No transactions available yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, index) => {
                    const status = String(tx.status || '').toLowerCase();
                    const statusClass =
                      status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700';

                    return (
                      <tr key={`${tx.id || 'tx'}-${index}`} className="border-t border-slate-100">
                        <td className="px-5 py-4 font-mono text-xs text-slate-800">{tx.id || 'N/A'}</td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-700">
                          {tx.sellerId || 'N/A'}
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          ₹{toNumber(tx.amount).toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}
                          >
                            {formatStatus(tx.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {formatDate(tx.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
