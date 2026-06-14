import { useMemo, type ReactElement } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, ChevronRight } from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { readStoredWebUser } from '@/lib/web-auth-storage';

type InAppNotification = {
  id: string;
  title: string;
  message: string;
  category?: string | null;
  actionUrl?: string | null;
  imageUrl?: string | null;
  isRead?: boolean;
  createdAt?: string;
};

type NotificationsResponse = {
  success?: boolean;
  data?: InAppNotification[];
  message?: string;
  error?: string;
};

function formatNotificationTime(timestamp?: string): string {
  if (!timestamp) return 'Just now';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeNotificationRoute(value?: string | null): string {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  try {
    const parsed = new URL(rawValue, window.location.origin);
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Fall back to app-relative handling below.
  }

  return rawValue.startsWith('/') ? rawValue : `/${rawValue}`;
}

export default function NotificationsPage(): ReactElement {
  const queryClient = useQueryClient();
  const user = readStoredWebUser();
  const userId = String(user?.id || '').trim();
  const userPhone = String(user?.phone || '').trim();

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...(userPhone ? { 'x-user-phone': userPhone } : {}),
    }),
    [userId, userPhone]
  );

  const notificationsQuery = useQuery({
    queryKey: ['notifications-page', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(
        `${getApiUrl()}/api/notifications?userId=${encodeURIComponent(userId)}&limit=100`,
        { headers }
      );
      const payload = (await response.json()) as NotificationsResponse;
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || payload.error || 'Failed to load notifications');
      }
      return payload.data || [];
    },
  });

  const notifications = useMemo(
    () =>
      [...(notificationsQuery.data || [])].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ),
    [notificationsQuery.data]
  );

  const markRead = async (notificationId: string) => {
    await fetch(`${getApiUrl()}/api/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId }),
    });
    await queryClient.invalidateQueries({
      queryKey: ['notifications-page', userId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['header-push-notifications', userId],
    });
  };

  if (!userId) return <Navigate to="/auth/register" replace />;

  return (
    <div className="min-h-screen bg-[#f7faff] text-slate-950">
      <LandingHeader active="browse" />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6 md:pb-14 lg:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h1 className="inline-flex items-center gap-2 text-2xl font-black text-slate-950">
              <Bell size={24} className="text-[#0759e6]" /> Notifications
            </h1>
            <Link to="/" className="text-sm font-semibold text-[#0759e6] hover:underline">
              Home
            </Link>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {notifications.length} notification
            {notifications.length === 1 ? '' : 's'}
          </p>
        </section>

        <section className="mt-5 space-y-3">
          {notificationsQuery.isLoading ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600">
              Loading notifications...
            </p>
          ) : null}
          {notificationsQuery.isError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
              Failed to load notifications.
            </p>
          ) : null}
          {!notificationsQuery.isLoading && notifications.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-600">
              No notifications yet.
            </p>
          ) : null}
          {notifications.map((notification) => {
            const actionRoute = normalizeNotificationRoute(notification.actionUrl);
            const content = (
              <>
                {notification.imageUrl ? (
                  <img
                    src={notification.imageUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 bg-slate-50 object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = '/nearhub.png';
                    }}
                  />
                ) : null}
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-slate-950">{notification.title}</h2>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                      {notification.message}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-slate-400">
                      {formatNotificationTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.isRead ? (
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0759e6]" />
                  ) : null}
                </div>
                {actionRoute ? <ChevronRight size={19} className="text-slate-400" /> : null}
              </>
            );

            return (
              <article
                key={notification.id}
                className={`flex items-start gap-3 rounded-2xl border p-4 shadow-sm ${
                  notification.isRead
                    ? 'border-slate-200 bg-white'
                    : 'border-[#0759e6]/25 bg-blue-50/50'
                }`}
              >
                {actionRoute ? (
                  <Link
                    to={actionRoute}
                    onClick={() => {
                      if (!notification.isRead) void markRead(notification.id);
                    }}
                    className="flex min-w-0 flex-1 items-start gap-3"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>
                )}
                {!notification.isRead ? (
                  <button
                    type="button"
                    onClick={() => void markRead(notification.id)}
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#0759e6] ring-1 ring-blue-100 transition hover:bg-blue-50"
                  >
                    <CheckCircle2 size={14} /> Read
                  </button>
                ) : null}
              </article>
            );
          })}
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
