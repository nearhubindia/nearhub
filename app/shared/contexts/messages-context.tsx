import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, InteractionManager } from 'react-native';

import { getApiUrl } from '@/lib/query-client';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';
import { useAuth } from '@/shared/contexts/auth-context';

export interface ChatMessage {
  id: string;
  conversationId?: string;
  listingId: string;
  text: string;
  sender: 'me' | 'seller';
  timestamp: string;
  readAt?: string | null;
  isRead?: boolean;
}

export interface ChatThread {
  conversationId: string;
  listingId: string;
  otherUserId?: string;
  otherUserAvatar?: string;
  sellerName: string;
  listingTitle: string;
  listingImage: string;
  messages: ChatMessage[];
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
}

interface MessagesContextValue {
  threads: ChatThread[];
  isLoading: boolean;
  unreadChatsCount: number;
  getThread: (id: string) => ChatThread | undefined;
  refreshThreads: () => Promise<void>;
  loadThreadMessages: (id: string) => Promise<ChatMessage[]>;
  sendMessage: (
    listingId: string,
    text: string,
    sellerName: string,
    listingTitle: string,
    listingImage: string,
    conversationId?: string
  ) => Promise<string | undefined>;
}

const MessagesContext = createContext<MessagesContextValue | null>(null);

interface ApiThread {
  conversationId: string;
  listingId: string;
  otherUserId?: string;
  otherUserAvatar?: string;
  listingTitle: string;
  listingImage: string;
  otherUserLabel: string;
  otherUserName?: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount?: number;
}

interface ApiMessage {
  id: string;
  conversationId: string;
  listingId: string;
  text: string;
  sender?: 'me' | 'seller' | string;
  senderId?: string;
  timestamp: string;
  readAt?: string | null;
  isRead?: boolean;
}

const THREADS_PAGE_SIZE = 50;
const MESSAGE_PAGE_SIZE = 120;
const THREADS_REFRESH_INTERVAL_MS = 30000;
const THREADS_MIN_REFRESH_INTERVAL_MS = 5000;

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return new Date().toISOString();
  return value;
}

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const threadsCountRef = useRef(0);
  const unreadChatsCount = useMemo(
    () =>
      threads.reduce(
        (sum, thread) =>
          sum + Math.max(0, Number.isFinite(thread.unreadCount) ? thread.unreadCount : 0),
        0
      ),
    [threads]
  );

  useEffect(() => {
    threadsCountRef.current = threads.length;
  }, [threads.length]);

  const getThread = useCallback(
    (id: string) => threads.find((t) => t.conversationId === id || t.listingId === id),
    [threads]
  );

  const fetchConversationMeta = useCallback(
    async (conversationId: string): Promise<ChatThread | null> => {
      if (!user?.id) return null;

      try {
        const res = await fetch(`${getApiUrl()}/api/messages/conversations/${conversationId}`, {
          method: 'GET',
          headers: buildUserAuthHeaders(
            { id: user.id, phone: user.phone, name: user.name },
            { includeName: true }
          ),
        });

        if (!res.ok) return null;

        const payload = await res.json();
        const data = payload?.data;
        if (!payload?.success || !data) return null;

        return {
          conversationId: data.conversationId,
          listingId: data.listingId,
          otherUserId: typeof data.otherUserId === 'string' ? data.otherUserId : '',
          otherUserAvatar: typeof data.otherUserAvatar === 'string' ? data.otherUserAvatar : '',
          sellerName: data.otherUserName || data.otherUserLabel || 'Seller',
          listingTitle: data.listingTitle || 'Listing',
          listingImage: data.listingImage || '',
          messages: [],
          lastMessage: '',
          lastTimestamp: new Date().toISOString(),
          unreadCount: 0,
        };
      } catch (error) {
        console.error('Failed to fetch conversation metadata:', error);
        return null;
      }
    },
    [user?.id, user?.name, user?.phone]
  );

  const refreshThreadsInternal = useCallback(
    async (options?: { force?: boolean; showLoading?: boolean }) => {
      if (!isAuthenticated || !user?.id) {
        setThreads([]);
        setIsLoading(false);
        return;
      }

      const force = options?.force === true;
      const showLoading = options?.showLoading === true;
      const now = Date.now();
      if (
        !force &&
        now - lastRefreshAtRef.current < THREADS_MIN_REFRESH_INTERVAL_MS &&
        threadsCountRef.current > 0
      ) {
        return;
      }

      if (refreshInFlightRef.current) {
        return refreshInFlightRef.current;
      }

      if (showLoading) {
        setIsLoading(true);
      }

      const run = (async () => {
        try {
          const response = await fetch(
            `${getApiUrl()}/api/messages/threads?limit=${THREADS_PAGE_SIZE}&offset=0`,
            {
              method: 'GET',
              headers: buildUserAuthHeaders(
                { id: user.id, phone: user.phone, name: user.name },
                { includeName: true }
              ),
            }
          );

          if (response.status === 401 || response.status === 403) {
            setThreads([]);
            return;
          }

          if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(
              `Failed to fetch message threads: ${response.status}${errorBody ? ` - ${errorBody}` : ''}`
            );
          }

          const payload = await response.json();
          const apiThreads: ApiThread[] = Array.isArray(payload?.data) ? payload.data : [];

          setThreads((prev) => {
            const byConversation = new Map(prev.map((thread) => [thread.conversationId, thread]));

            return apiThreads.map((item) => {
              const existing = byConversation.get(item.conversationId);
              return {
                conversationId: item.conversationId,
                listingId: item.listingId,
                otherUserId: item.otherUserId || existing?.otherUserId || '',
                otherUserAvatar: item.otherUserAvatar || existing?.otherUserAvatar || '',
                sellerName:
                  item.otherUserName || item.otherUserLabel || existing?.sellerName || 'Seller',
                listingTitle: item.listingTitle || existing?.listingTitle || 'Listing',
                listingImage: item.listingImage || existing?.listingImage || '',
                messages: existing?.messages || [],
                lastMessage: item.lastMessage || existing?.lastMessage || '',
                lastTimestamp: normalizeTimestamp(item.lastTimestamp || existing?.lastTimestamp),
                unreadCount:
                  typeof item.unreadCount === 'number'
                    ? item.unreadCount
                    : existing?.unreadCount || 0,
              };
            });
          });
          lastRefreshAtRef.current = Date.now();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`Failed to load message threads: ${message}`);
        } finally {
          if (showLoading) {
            setIsLoading(false);
          }
        }
      })();

      refreshInFlightRef.current = run.finally(() => {
        refreshInFlightRef.current = null;
      });
      return refreshInFlightRef.current;
    },
    [isAuthenticated, user?.id, user?.name, user?.phone]
  );

  const refreshThreads = useCallback(async () => {
    await refreshThreadsInternal({ force: true, showLoading: true });
  }, [refreshThreadsInternal]);

  const loadThreadMessages = useCallback(
    async (id: string): Promise<ChatMessage[]> => {
      if (!isAuthenticated || !user?.id || !id) return [];

      let thread = getThread(id);
      if (!thread && id) {
        const meta = await fetchConversationMeta(id);
        if (meta) {
          setThreads((prev) => {
            const exists = prev.some((t) => t.conversationId === meta.conversationId);
            return exists ? prev : [meta, ...prev];
          });
          thread = meta;
        }
      }

      if (!thread) return [];

      try {
        const response = await fetch(
          `${getApiUrl()}/api/messages/conversations/${thread.conversationId}/messages?limit=${MESSAGE_PAGE_SIZE}&offset=0`,
          {
            method: 'GET',
            headers: buildUserAuthHeaders(
              { id: user.id, phone: user.phone, name: user.name },
              { includeName: true }
            ),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.status}`);
        }

        const payload = await response.json();
        const apiMessages: ApiMessage[] = Array.isArray(payload?.data)
          ? payload.data.filter((item: unknown): item is ApiMessage =>
              Boolean(item && typeof item === 'object')
            )
          : [];

        const mapped: ChatMessage[] = apiMessages
          .map((item) => {
            const sender: ChatMessage['sender'] =
              item.sender === 'me' || item.sender === 'seller'
                ? item.sender
                : item.senderId && item.senderId === user.id
                  ? 'me'
                  : 'seller';

            const messageId =
              typeof item.id === 'string' && item.id.trim()
                ? item.id
                : `${item.conversationId || thread!.conversationId}-${normalizeTimestamp(item.timestamp)}`;

            return {
              id: messageId,
              conversationId: item.conversationId || thread!.conversationId,
              listingId: item.listingId || thread!.listingId,
              text: typeof item.text === 'string' ? item.text : '',
              sender,
              timestamp: normalizeTimestamp(item.timestamp),
              readAt: typeof item.readAt === 'string' ? item.readAt : null,
              isRead: typeof item.isRead === 'boolean' ? item.isRead : Boolean(item.readAt),
            };
          })
          .filter((item) => item.text.trim().length > 0);

        setThreads((prev) =>
          prev.map((t) =>
            t.conversationId === thread!.conversationId
              ? {
                  ...t,
                  messages: mapped,
                  lastMessage: mapped[mapped.length - 1]?.text || t.lastMessage,
                  lastTimestamp:
                    mapped[mapped.length - 1]?.timestamp || normalizeTimestamp(t.lastTimestamp),
                  unreadCount: 0,
                }
              : t
          )
        );

        return mapped;
      } catch (error) {
        console.error('Failed to load thread messages:', error);
        return thread.messages;
      }
    },
    [fetchConversationMeta, getThread, isAuthenticated, user?.id, user?.name, user?.phone]
  );

  const sendMessage = useCallback(
    async (
      listingId: string,
      text: string,
      sellerName: string,
      listingTitle: string,
      listingImage: string,
      conversationId?: string
    ): Promise<string | undefined> => {
      if (!isAuthenticated || !user?.id) {
        throw new Error('User must be signed in to send messages');
      }

      const trimmedText = text.trim();
      if (!trimmedText) return conversationId;

      const response = await fetch(`${getApiUrl()}/api/messages/send`, {
        method: 'POST',
        headers: buildUserAuthHeaders(
          { id: user.id, phone: user.phone, name: user.name },
          { includeName: true }
        ),
        body: JSON.stringify({
          listingId,
          conversationId,
          text: trimmedText,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Failed to send message' }));
        throw new Error(body?.error || 'Failed to send message');
      }

      const payload = await response.json();
      const result = payload?.data;
      const resolvedConversationId: string | undefined = result?.conversationId || conversationId;
      const message = result?.message;
      const inferredOtherUserId =
        typeof result?.otherUserId === 'string'
          ? result.otherUserId
          : typeof result?.message?.recipientId === 'string'
            ? result.message.recipientId
            : '';

      if (!resolvedConversationId || !message) {
        await refreshThreadsInternal({ force: true, showLoading: false });
        return resolvedConversationId;
      }

      const localMessage: ChatMessage = {
        id: message.id,
        conversationId: resolvedConversationId,
        listingId: result.listingId || listingId,
        text: message.text,
        sender: 'me',
        timestamp: normalizeTimestamp(message.timestamp),
        readAt: null,
        isRead: false,
      };

      setThreads((prev) => {
        const existingIndex = prev.findIndex((t) => t.conversationId === resolvedConversationId);

        if (existingIndex >= 0) {
          const updated = [...prev];
          const existing = updated[existingIndex];
          const resolvedOtherUserId =
            result.otherUserId || existing.otherUserId || inferredOtherUserId;
          const resolvedOtherUserAvatar = result.otherUserAvatar || existing.otherUserAvatar || '';
          const resolvedSellerName =
            result.otherUserName ||
            result.otherUserLabel ||
            existing.sellerName ||
            sellerName ||
            'Seller';
          updated[existingIndex] = {
            ...existing,
            listingId: result.listingId || existing.listingId || listingId,
            otherUserId: resolvedOtherUserId,
            otherUserAvatar: resolvedOtherUserAvatar,
            sellerName: resolvedSellerName,
            messages: [...existing.messages, localMessage],
            lastMessage: localMessage.text,
            lastTimestamp: localMessage.timestamp,
            unreadCount: 0,
          };
          const [changed] = updated.splice(existingIndex, 1);
          updated.unshift(changed);
          return updated;
        }

        return [
          {
            conversationId: resolvedConversationId,
            listingId: result.listingId || listingId,
            otherUserId: result.otherUserId || inferredOtherUserId,
            otherUserAvatar: result.otherUserAvatar || '',
            sellerName: result.otherUserName || result.otherUserLabel || sellerName || 'Seller',
            listingTitle: listingTitle || 'Listing',
            listingImage: listingImage || '',
            messages: [localMessage],
            lastMessage: localMessage.text,
            lastTimestamp: localMessage.timestamp,
            unreadCount: 0,
          },
          ...prev,
        ];
      });

      // Sync metadata (names/images/timestamps) from server source-of-truth.
      await refreshThreadsInternal({ force: true, showLoading: false });
      return resolvedConversationId;
    },
    [isAuthenticated, refreshThreadsInternal, user?.id, user?.name, user?.phone]
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setThreads([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let initialFetchTimer: ReturnType<typeof setTimeout> | null = null;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      initialFetchTimer = setTimeout(() => {
        if (cancelled) return;
        void refreshThreadsInternal({ force: true, showLoading: false });
      }, 800);
    });

    return () => {
      cancelled = true;
      interactionTask.cancel();
      if (initialFetchTimer) {
        clearTimeout(initialFetchTimer);
      }
    };
  }, [isAuthenticated, refreshThreadsInternal, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active' && isAuthenticated && user?.id) {
        void refreshThreadsInternal({ force: false, showLoading: false });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, refreshThreadsInternal, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const interval = setInterval(() => {
      if (appStateRef.current !== 'active') {
        return;
      }

      refreshThreadsInternal({ force: false, showLoading: false }).catch((error) => {
        console.error('Failed to refresh threads in background:', error);
      });
    }, THREADS_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshThreadsInternal, user?.id]);

  const value = useMemo(
    () => ({
      threads,
      isLoading,
      unreadChatsCount,
      getThread,
      refreshThreads,
      loadThreadMessages,
      sendMessage,
    }),
    [
      getThread,
      isLoading,
      loadThreadMessages,
      refreshThreads,
      sendMessage,
      threads,
      unreadChatsCount,
    ]
  );

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessages() {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
}
