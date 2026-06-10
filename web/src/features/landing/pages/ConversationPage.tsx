import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { getApiUrl } from '@/lib/config';

type StoredUser = { id?: string; phone?: string; name?: string };

type ConversationMeta = {
  conversationId: string;
  listingId: string;
  listingTitle?: string;
  listingImage?: string;
  otherUserLabel?: string;
};

type ChatMessage = {
  id: string;
  text: string;
  sender: 'me' | 'seller';
  timestamp: string;
  isRead?: boolean;
};

function readStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('nearhub_web_user');
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export default function ConversationPage(): ReactElement {
  const { conversationId = '' } = useParams();
  const user = readStoredUser();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
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

  const metaQuery = useQuery({
    queryKey: ['conversation-meta', conversationId, userId],
    enabled: Boolean(userId && conversationId),
    queryFn: async () => {
      const response = await fetch(
        `${getApiUrl()}/api/messages/conversations/${encodeURIComponent(conversationId)}`,
        { headers }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success)
        throw new Error(payload.error || 'Failed to load conversation');
      return payload.data as ConversationMeta;
    },
  });

  const messagesQuery = useQuery({
    queryKey: ['conversation-messages', conversationId, userId],
    enabled: Boolean(userId && conversationId),
    queryFn: async () => {
      const response = await fetch(
        `${getApiUrl()}/api/messages/conversations/${encodeURIComponent(conversationId)}/messages?limit=200`,
        { headers }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success)
        throw new Error(payload.error || 'Failed to load messages');
      return (payload.data || []) as ChatMessage[];
    },
  });

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    setSendError('');
    try {
      const response = await fetch(`${getApiUrl()}/api/messages/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ conversationId, text }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success)
        throw new Error(payload.error || 'Failed to send message');
      setDraft('');
      setLastSentAt(new Date().toISOString());
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['conversation-messages', conversationId, userId],
        }),
        queryClient.invalidateQueries({ queryKey: ['message-threads', userId] }),
      ]);
    } catch (error: unknown) {
      setSendError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!sending && draft.trim()) {
        void sendMessage();
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messagesQuery.data, sending]);

  if (!userId) return <Navigate to="/auth/register" replace />;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffef8_0%,#eef6ff_58%,#f8fbff_100%)] text-slate-900">
      <LandingHeader active="browse" />
      <main className="mx-auto max-w-4xl px-4 pb-14 pt-28 sm:px-6">
        <section className="rounded-3xl border border-[#1e5da8]/15 bg-white p-5 shadow-[0_24px_60px_-42px_rgba(30,93,168,0.68)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Conversation
              </p>
              <h1 className="text-xl font-bold text-[#113965]">
                {metaQuery.data?.listingTitle || 'Chat'}
              </h1>
              <p className="text-sm text-slate-600">
                with {metaQuery.data?.otherUserLabel || 'User'}
              </p>
            </div>
            <Link to="/messages" className="text-sm font-semibold text-[#1e5da8] hover:underline">
              Back to Messages
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 pb-2">
          {messagesQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading messages...</p>
          ) : null}
          {messagesQuery.isError ? (
            <p className="text-sm text-red-600">Failed to load messages.</p>
          ) : null}

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {(messagesQuery.data || []).map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.sender === 'me' ? 'bg-[#1e5da8] text-white' : 'bg-slate-100 text-slate-800'}`}
                >
                  <p>{message.text}</p>
                  <p
                    className={`mt-1 text-[10px] ${message.sender === 'me' ? 'text-blue-100' : 'text-slate-500'}`}
                  >
                    {new Date(message.timestamp).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            ))}
            {!messagesQuery.isLoading && (messagesQuery.data || []).length === 0 ? (
              <p className="text-center text-sm text-slate-500">No messages yet. Say hello.</p>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <div className="sticky bottom-0 mt-4 border-t border-slate-100 bg-white pt-3">
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Type your message"
                className="h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={sending || !draft.trim()}
                className="h-10 rounded-xl bg-[#1e5da8] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
            <div className="mt-2 min-h-4">
              {sendError ? <p className="text-xs text-rose-600">{sendError}</p> : null}
              {!sendError && lastSentAt ? (
                <p className="text-xs text-slate-500">
                  Last sent at {new Date(lastSentAt).toLocaleTimeString('en-IN')}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
