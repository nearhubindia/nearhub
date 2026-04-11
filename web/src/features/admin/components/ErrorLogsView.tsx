import { useMemo, useState } from 'react';
import { AlertOctagon, RefreshCcw, Search } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import {
  useCleanupErrorLogs,
  useErrorLogs,
  useResetErrorLogs,
  useResolveErrorLog,
} from '@/features/admin/hooks';

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function levelBadge(level: string): string {
  const normalized = level.toLowerCase();
  if (normalized === 'fatal') return 'bg-red-600 text-white';
  if (normalized === 'error') return 'bg-red-100 text-red-700';
  if (normalized === 'warn') return 'bg-amber-100 text-amber-700';
  if (normalized === 'info') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-700';
}

export default function ErrorLogsView() {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [environment, setEnvironment] = useState('');
  const [includeResolved, setIncludeResolved] = useState(false);
  const [limit, setLimit] = useState(50);

  const queryParams = useMemo(
    () => ({
      limit,
      offset: 0,
      level: level || undefined,
      environment: environment || undefined,
      search: search.trim() || undefined,
      include_resolved: includeResolved || undefined,
    }),
    [environment, includeResolved, level, limit, search]
  );

  const { data, isLoading, refetch, isRefetching } = useErrorLogs(queryParams);
  const resetLogs = useResetErrorLogs();
  const cleanupLogs = useCleanupErrorLogs();
  const resolveOneLog = useResolveErrorLog();
  const logs = data?.logs || [];

  const columns = useMemo<ColumnDef<(typeof logs)[number]>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Time',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter time...' },
        cell: ({ row }) => <span className="text-sm text-slate-600">{formatDateTime(row.original.createdAt)}</span>,
      },
      {
        accessorKey: 'level',
        header: 'Level',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter level...' },
        cell: ({ row }) => (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${levelBadge(row.original.level)}`}
          >
            {row.original.level}
          </span>
        ),
      },
      {
        accessorKey: 'message',
        header: 'Message',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter message...' },
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-slate-900">{row.original.message}</p>
            {row.original.stackTrace && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-teal-700">stack trace</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-2 text-xs text-slate-100">
                  {row.original.stackTrace}
                </pre>
              </details>
            )}
          </div>
        ),
      },
      {
        id: 'app',
        header: 'App/Env',
        enableColumnFilter: true,
        accessorFn: (log) => `${log.appName || 'nearhub'} ${log.environment} ${log.appVersion || ''}`,
        meta: { filterPlaceholder: 'Filter app...' },
        cell: ({ row }) => (
          <div className="text-sm text-slate-700">
            <p className="font-semibold">{row.original.appName || 'nearhub'}</p>
            <p>{row.original.environment}</p>
            <p className="text-xs text-slate-500">{row.original.appVersion || '-'}</p>
          </div>
        ),
      },
      {
        id: 'endpoint',
        header: 'Endpoint / Count',
        enableColumnFilter: true,
        accessorFn: (log) =>
          `${log.method || ''} ${log.endpoint || ''} ${log.statusCode || ''} ${log.occurrenceCount || 1}`,
        meta: { filterPlaceholder: 'Filter endpoint...' },
        cell: ({ row }) => {
          const log = row.original;
          return (
            <div className="text-sm text-slate-700">
              {log.method && <span className="font-semibold">{log.method} </span>}
              {log.endpoint || '-'}
              {log.statusCode && (
                <span className="ml-2 text-xs text-slate-500">[{log.statusCode}]</span>
              )}
              <p className="mt-1 text-xs text-slate-500">occurrences: {log.occurrenceCount || 1}</p>
              <p className="text-xs text-slate-500">
                last seen: {formatDateTime(log.lastSeenAt || log.createdAt)}
              </p>
              {log.resolved && (
                <span className="mt-1 inline-flex rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                  resolved
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'user',
        header: 'User',
        enableColumnFilter: true,
        accessorFn: (log) => `${log.userId || ''} ${log.device || ''} ${log.ipAddress || ''}`,
        meta: { filterPlaceholder: 'Filter user...' },
        cell: ({ row }) => (
          <div className="text-sm text-slate-700">
            <p>{row.original.userId || '-'}</p>
            <p className="text-xs text-slate-500">{row.original.device || '-'}</p>
            <p className="text-xs text-slate-500">{row.original.ipAddress || '-'}</p>
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        accessorFn: () => '',
        cell: ({ row }) => (
          <button
            onClick={() =>
              resolveOneLog.mutate({
                id: row.original.id,
                resolved: !row.original.resolved,
              })
            }
            disabled={resolveOneLog.isPending}
            className={`rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              row.original.resolved
                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
            type="button"
          >
            {resolveOneLog.isPending
              ? 'Saving...'
              : row.original.resolved
                ? 'Mark Unresolved'
                : 'Mark Resolved'}
          </button>
        ),
      },
    ],
    [resolveOneLog]
  );

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-6 border-b border-slate-700">
        <h1 className="text-3xl sm:text-4xl font-black mb-2">Error Logs</h1>
        <p className="text-slate-300">
          Centralized runtime errors from mobile app, web app, and backend APIs
        </p>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search message, stack, endpoint..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All levels</option>
            <option value="fatal">fatal</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
            <option value="debug">debug</option>
          </select>
          <input
            type="text"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            placeholder="Environment (production)"
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <div className="flex gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white">
              <input
                type="checkbox"
                checked={includeResolved}
                onChange={(e) => setIncludeResolved(e.target.checked)}
                className="accent-teal-600"
              />
              Resolved
            </label>
            <select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value) || 100)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition font-semibold text-slate-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <RefreshCcw size={16} className={isRefetching ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (!confirm('Mark all currently filtered unresolved logs as resolved?')) return;
              resetLogs.mutate({
                level: level || undefined,
                app_name: undefined,
                include_resolved: false,
              });
            }}
            disabled={resetLogs.isPending}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold disabled:opacity-50"
          >
            {resetLogs.isPending ? 'Resolving...' : 'Resolve Filtered Logs'}
          </button>
          <button
            onClick={() => {
              if (!confirm('Delete all resolved logs permanently?')) return;
              cleanupLogs.mutate({
                mode: 'resolved',
              });
            }}
            disabled={cleanupLogs.isPending}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold disabled:opacity-50"
          >
            {cleanupLogs.isPending ? 'Cleaning...' : 'Cleanup Resolved Logs'}
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-600">
            Loading logs...
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={logs}
            showSearch={false}
            searchPlaceholder="Search logs..."
          />
        )}

        <div className="text-sm text-slate-600 inline-flex items-center gap-2">
          <AlertOctagon size={16} />
          Showing {logs.length} of {data?.total || 0} logs
        </div>
      </div>
    </div>
  );
}
