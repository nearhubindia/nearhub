import { useMemo, useState } from 'react';
import { Activity, RefreshCcw, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { useCleanupErrorLogs, useErrorLogs } from '@/features/admin/hooks';

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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [levelInput, setLevelInput] = useState('');
  const [level, setLevel] = useState('');
  const [limit, setLimit] = useState(50);

  const queryParams = useMemo(
    () => ({
      limit,
      offset: 0,
      level: level || undefined,
      search: search.trim() || undefined,
      // OPD365 monitoring shows both unresolved and resolved records by default.
      include_resolved: true,
    }),
    [level, limit, search]
  );

  const { data, isLoading, refetch, isRefetching } = useErrorLogs(queryParams);
  const cleanupLogs = useCleanupErrorLogs();
  const logs = data?.logs || [];

  const applyFilters = (): void => {
    setSearch(searchInput.trim());
    setLevel(levelInput);
  };

  const columns = useMemo<ColumnDef<(typeof logs)[number]>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Time',
        enableColumnFilter: true,
        meta: { filterPlaceholder: 'Filter time...' },
        cell: ({ row }) => (
          <span className="text-sm text-slate-600">{formatDateTime(row.original.createdAt)}</span>
        ),
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
        accessorFn: (log) =>
          `${log.appName || 'nearhub'} ${log.environment} ${log.appVersion || ''}`,
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
    ],
    []
  );

  return (
    <div>
      <div className="admin-page-header border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mb-1 text-3xl font-black sm:text-4xl">Error Logs</h1>
            <p className="text-slate-300">
              Centralized runtime errors from mobile app, web app, and backend APIs
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
            <Activity size={14} className="text-teal-300" />
            Runtime monitoring
          </div>
        </div>
      </div>

      <div className="space-y-4 p-3 sm:p-5">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-600">
                <SlidersHorizontal size={16} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Runtime monitoring</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Review application errors across NearHub surfaces and clear them when necessary.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {logs.length} of {data?.total || 0} loaded
            </span>
          </div>

          <form
            className="space-y-3 p-4 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Search</label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Message, stack, endpoint, screen"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Level</label>
                <select
                  value={levelInput}
                  onChange={(e) => setLevelInput(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                >
                  <option value="">All levels</option>
                  <option value="fatal">fatal</option>
                  <option value="error">error</option>
                  <option value="warn">warn</option>
                  <option value="info">info</option>
                  <option value="debug">debug</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Rows</label>
                <select
                  value={String(limit)}
                  onChange={(e) => setLimit(Number(e.target.value) || 50)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                >
                  <option value="50">50 rows</option>
                  <option value="100">100 rows</option>
                  <option value="200">200 rows</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-100"
              >
                <Search size={16} />
                Apply filters
              </button>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCcw size={16} className={isRefetching ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm('Delete all error logs permanently?')) return;
                  cleanupLogs.mutate({ mode: 'all' });
                }}
                disabled={cleanupLogs.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={15} />
                {cleanupLogs.isPending ? 'Clearing...' : 'Clear All Logs'}
              </button>
            </div>
          </form>
        </section>

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            Loading logs...
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={logs}
            showSearch={false}
            showColumnVisibility={false}
            showPagination={false}
            searchPlaceholder="Search logs..."
            initialPageSize={limit}
            pageSizeOptions={[50, 100, 200]}
            dense
          />
        )}

        <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
          Showing {logs.length} of {data?.total || 0} logs
        </div>
      </div>
    </div>
  );
}
