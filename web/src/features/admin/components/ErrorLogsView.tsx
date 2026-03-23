import { useMemo, useState } from 'react';
import { AlertOctagon, RefreshCcw, Search } from 'lucide-react';
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

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-600">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-600">No error logs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Time</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Level</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Message</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">
                      App/Env
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">
                      Endpoint / Count
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">User</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-200 align-top">
                      <td className="px-4 py-4 text-sm text-slate-600">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${levelBadge(log.level)}`}
                        >
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">{log.message}</p>
                        {log.stackTrace && (
                          <details className="mt-2">
                            <summary className="text-xs text-teal-700 cursor-pointer">
                              stack trace
                            </summary>
                            <pre className="mt-2 p-2 bg-slate-900 text-slate-100 text-xs rounded overflow-auto max-h-40 whitespace-pre-wrap">
                              {log.stackTrace}
                            </pre>
                          </details>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <p className="font-semibold">{log.appName || 'nearhub'}</p>
                        <p>{log.environment}</p>
                        <p className="text-xs text-slate-500">{log.appVersion || '-'}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {log.method && <span className="font-semibold">{log.method} </span>}
                        {log.endpoint || '-'}
                        {log.statusCode && (
                          <span className="ml-2 text-xs text-slate-500">[{log.statusCode}]</span>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          occurrences: {log.occurrenceCount || 1}
                        </p>
                        <p className="text-xs text-slate-500">
                          last seen: {formatDateTime(log.lastSeenAt || log.createdAt)}
                        </p>
                        {log.resolved && (
                          <span className="inline-flex mt-1 px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">
                            resolved
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <p>{log.userId || '-'}</p>
                        <p className="text-xs text-slate-500">{log.device || '-'}</p>
                        <p className="text-xs text-slate-500">{log.ipAddress || '-'}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <button
                          onClick={() =>
                            resolveOneLog.mutate({
                              id: log.id,
                              resolved: !log.resolved,
                            })
                          }
                          disabled={resolveOneLog.isPending}
                          className={`px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50 ${
                            log.resolved
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'bg-teal-600 text-white hover:bg-teal-700'
                          }`}
                        >
                          {resolveOneLog.isPending
                            ? 'Saving...'
                            : log.resolved
                              ? 'Mark Unresolved'
                              : 'Mark Resolved'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-sm text-slate-600 inline-flex items-center gap-2">
          <AlertOctagon size={16} />
          Showing {logs.length} of {data?.total || 0} logs
        </div>
      </div>
    </div>
  );
}
