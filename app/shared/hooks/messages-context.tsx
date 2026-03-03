import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MESSAGES_KEY = '@marketlocal_messages';

export interface ChatMessage {
  id: string;
  listingId: string;
  text: string;
  sender: 'me' | 'seller';
  timestamp: string;
}

export interface ChatThread {
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
  getThread: (listingId: string) => ChatThread | undefined;
  sendMessage: (
    listingId: string,
    text: string,
    sellerName: string,
    listingTitle: string,
    listingImage: string
  ) => Promise<void>;
  getAutoReply: (listingTitle: string) => string;
}

const MessagesContext = createContext<MessagesContextValue | null>(null);

const AUTO_REPLIES = [
  'Thanks for your interest! The item is still available.',
  "Hi! Yes, it's available. Would you like to see more photos?",
  'Hey there! Sure, I can hold it for you. When can you pick up?',
  'Thanks for reaching out! I can offer a small discount if you pick it up today.',
  "Hi! Great choice. It's in excellent condition. Any questions?",
  "Hello! Yes, the price is negotiable. What's your offer?",
];

export function MessagesProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadThreads();
  }, []);

  const loadThreads = async () => {
    try {
      const stored = await AsyncStorage.getItem(MESSAGES_KEY);
      if (stored) {
        setThreads(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveThreads = async (updated: ChatThread[]) => {
    setThreads(updated);
    await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
  };

  const getThread = (listingId: string) => threads.find((t) => t.listingId === listingId);

  const getAutoReply = (listingTitle: string) => {
    const idx = Math.floor(Math.random() * AUTO_REPLIES.length);
    return AUTO_REPLIES[idx];
  };

  const sendMessage = async (
    listingId: string,
    text: string,
    sellerName: string,
    listingTitle: string,
    listingImage: string
  ) => {
    const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();

    const newMsg: ChatMessage = {
      id: msgId,
      listingId,
      text,
      sender: 'me',
      timestamp: now,
    };

    let updated = [...threads];
    const existingIdx = updated.findIndex((t) => t.listingId === listingId);

    if (existingIdx >= 0) {
      updated[existingIdx] = {
        ...updated[existingIdx],
        messages: [...updated[existingIdx].messages, newMsg],
        lastMessage: text,
        lastTimestamp: now,
      };
    } else {
      updated.unshift({
        listingId,
        sellerName,
        listingTitle,
        listingImage,
        messages: [newMsg],
        lastMessage: text,
        lastTimestamp: now,
      });
    }

    await saveThreads(updated);

    setTimeout(
      async () => {
        const replyId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const replyTime = new Date().toISOString();
        const replyText = getAutoReply(listingTitle);

        const replyMsg: ChatMessage = {
          id: replyId,
          listingId,
          text: replyText,
          sender: 'seller',
          timestamp: replyTime,
        };

        const latestStored = await AsyncStorage.getItem(MESSAGES_KEY);
        let latestThreads: ChatThread[] = latestStored ? JSON.parse(latestStored) : [];
        const idx = latestThreads.findIndex((t) => t.listingId === listingId);
        if (idx >= 0) {
          latestThreads[idx] = {
            ...latestThreads[idx],
            messages: [...latestThreads[idx].messages, replyMsg],
            lastMessage: replyText,
            lastTimestamp: replyTime,
          };
          await saveThreads(latestThreads);
        }
      },
      1500 + Math.random() * 2000
    );
  };

  const value = useMemo(
    () => ({ threads, isLoading, getThread, sendMessage, getAutoReply }),
    [threads, isLoading]
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
