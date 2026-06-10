import { useMemo, type ReactElement } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock3, MessageCircle } from 'lucide-react';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { getApiUrl } from '@/lib/config';

type StoredUser = { id?: string; phone?: string; name?: string };

type Thread = {
  conversationId: string;
  listingId: string;
  listingTitle?: string;
  listingImage?: string;
  otherUserId?: string;
  otherUserLabel?: string;
  otherUserName?: string;
  otherUserAvatar?: string;
  lastMessage?: string;
  lastTimestamp?: string;
  unreadCount?: number;
};

type ThreadResponse = { success?: boolean; data?: Thread[]; error?: string };

function readStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('nearhub_web_user');
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

function formatTimeAgo(timestamp?: string): string {
  if (!timestamp) return 'now';
  const ms = Date.now() - new Date(timestamp).getTime();
  const mins = Math.max(1, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function MessagesPage(): ReactElement {
  const user = readStoredUser();
  const userId = String(user?.id || '').trim();
  const userPhone = String(user?.phone || '').trim();

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-phone': userPhone,
    }),
    [userId, userPhone]
  );

  const threadsQuery = useQuery({
    queryKey: ['message-threads', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/messages/threads?limit=50`, {
        headers,
      });
      const payload = (await response.json()) as ThreadResponse;
      if (!response.ok || !payload.success)
        throw new Error(payload.error || 'Failed to load messages');
      return payload.data || [];
    },
  });

  const threads = useMemo(
    () =>
      [...(threadsQuery.data || [])].sort(
        (a, b) =>
          new Date(b.lastTimestamp || 0).getTime() - new Date(a.lastTimestamp || 0).getTime()
      ),
    [threadsQuery.data]
  );

  if (!userId) return <Navigate to="/auth/register" replace />;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffef8_0%,#eef6ff_58%,#f8fbff_100%)] text-slate-900">
      <LandingHeader active="browse" />
      <main className="mx-auto max-w-5xl px-4 pb-14 pt-28 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-[#1e5da8]/15 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(30,93,168,0.68)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-[#113965]">Messages</h1>
            <Link to="/deals" className="text-sm font-semibold text-[#1e5da8] hover:underline">
              Back to Deals
            </Link>
          </div>
          <p className="mt-2 text-sm text-slate-600">{threads.length} conversation(s)</p>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-3">
            <h2 className="inline-flex items-center gap-2 text-lg font-black text-slate-950">
              <MessageCircle size={20} /> Messages
            </h2>
            {threadsQuery.isLoading ? <p className="text-slate-600">Loading messages...</p> : null}
            {threadsQuery.isError ? <p className="text-red-600">Failed to load messages.</p> : null}

            {threads.map((thread) => (
              <article
                key={thread.conversationId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {thread.listingImage ? (
                      <img
                        src={thread.listingImage}
                        alt={thread.listingTitle || 'Listing'}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <MessageCircle size={18} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-1 text-base font-semibold text-slate-900">
                        {thread.listingTitle || 'Listing'}
                      </h2>
                      <p className="whitespace-nowrap text-xs text-slate-500">
                        {formatTimeAgo(thread.lastTimestamp)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-[#1e5da8]">
                      {thread.otherUserLabel || thread.otherUserName || 'User'}
                    </p>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-600">
                      {thread.lastMessage || 'No messages yet'}
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Clock3 size={12} />{' '}
                        {thread.lastTimestamp
                          ? new Date(thread.lastTimestamp).toLocaleString('en-IN')
                          : 'Just now'}
                      </p>
                      <div className="flex items-center gap-3">
                        {thread.unreadCount && thread.unreadCount > 0 ? (
                          <span className="rounded-full bg-[#1e5da8] px-2 py-0.5 text-xs font-semibold text-white">
                            {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                          </span>
                        ) : null}
                        <Link
                          to={`/messages/${thread.conversationId}`}
                          className="text-xs font-semibold text-[#ff7b00] hover:underline"
                        >
                          Open Chat
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {!threadsQuery.isLoading && threads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-600">
                No conversations yet. Start by messaging from a listing.
              </div>
            ) : null}
          </section>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
