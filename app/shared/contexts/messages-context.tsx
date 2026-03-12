import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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
}

export interface ChatThread {
  conversationId: string;
  listingId: string;
  sellerName: string;
  listingTitle: string;
  listingImage: string;
  messages: ChatMessage[];
  lastMessage: string;
  lastTimestamp: string;
}

interface MessagesContextValue {
  threads: ChatThread[];
  isLoading: boolean;
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
  listingTitle: string;
  listingImage: string;
  otherUserLabel: string;
  otherUserName?: string;
  lastMessage: string;
  lastTimestamp: string;
}

interface ApiMessage {
  id: string;
  conversationId: string;
  listingId: string;
  text: string;
  sender?: 'me' | 'seller' | string;
  senderId?: string;
  timestamp: string;
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return new Date().toISOString();
  return value;
}

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          sellerName: data.otherUserName || data.otherUserLabel || 'Seller',
          listingTitle: data.listingTitle || 'Listing',
          listingImage: data.listingImage || '',
          messages: [],
          lastMessage: '',
          lastTimestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error('Failed to fetch conversation metadata:', error);
        return null;
      }
    },
    [user?.id, user?.phone]
  );

  const refreshThreads = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setThreads([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${getApiUrl()}/api/messages/threads`, {
        method: 'GET',
        headers: buildUserAuthHeaders(
          { id: user.id, phone: user.phone, name: user.name },
          { includeName: true }
        ),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch message threads: ${response.status}`);
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
            sellerName: item.otherUserName || item.otherUserLabel || existing?.sellerName || 'Seller',
            listingTitle: item.listingTitle || existing?.listingTitle || 'Listing',
            listingImage: item.listingImage || existing?.listingImage || '',
            messages: existing?.messages || [],
            lastMessage: item.lastMessage || existing?.lastMessage || '',
            lastTimestamp: normalizeTimestamp(item.lastTimestamp || existing?.lastTimestamp),
          };
        });
      });
    } catch (error) {
      console.error('Failed to load message threads:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id, user?.phone]);

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
          `${getApiUrl()}/api/messages/conversations/${thread.conversationId}/messages`,
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
          ? payload.data.filter(
              (item: unknown): item is ApiMessage => Boolean(item && typeof item === 'object')
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
    [fetchConversationMeta, getThread, isAuthenticated, user?.id, user?.phone]
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

      if (!resolvedConversationId || !message) {
        await refreshThreads();
        return resolvedConversationId;
      }

      const localMessage: ChatMessage = {
        id: message.id,
        conversationId: resolvedConversationId,
        listingId: result.listingId || listingId,
        text: message.text,
        sender: 'me',
        timestamp: normalizeTimestamp(message.timestamp),
      };

      setThreads((prev) => {
        const existingIndex = prev.findIndex((t) => t.conversationId === resolvedConversationId);

        if (existingIndex >= 0) {
          const updated = [...prev];
          const existing = updated[existingIndex];
          updated[existingIndex] = {
            ...existing,
            listingId: result.listingId || existing.listingId || listingId,
            messages: [...existing.messages, localMessage],
            lastMessage: localMessage.text,
            lastTimestamp: localMessage.timestamp,
          };
          const [changed] = updated.splice(existingIndex, 1);
          updated.unshift(changed);
          return updated;
        }

        return [
          {
            conversationId: resolvedConversationId,
            listingId: result.listingId || listingId,
            sellerName: sellerName || 'Seller',
            listingTitle: listingTitle || 'Listing',
            listingImage: listingImage || '',
            messages: [localMessage],
            lastMessage: localMessage.text,
            lastTimestamp: localMessage.timestamp,
          },
          ...prev,
        ];
      });

      // Sync metadata (names/images/timestamps) from server source-of-truth.
      await refreshThreads();
      return resolvedConversationId;
    },
    [isAuthenticated, refreshThreads, user?.id, user?.phone]
  );

  useEffect(() => {
    setIsLoading(true);
    refreshThreads();
  }, [refreshThreads]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const interval = setInterval(() => {
      refreshThreads().catch((error) => {
        console.error('Failed to refresh threads in background:', error);
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshThreads, user?.id]);

  const value = useMemo(
    () => ({
      threads,
      isLoading,
      getThread,
      refreshThreads,
      loadThreadMessages,
      sendMessage,
    }),
    [getThread, isLoading, loadThreadMessages, refreshThreads, sendMessage, threads]
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
