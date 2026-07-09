import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '@/lib/query-client';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';
import {
  usePushNotifications,
  type PushNotificationData,
} from '@/shared/hooks/use-push-notifications';
import { useAuth } from '@/shared/contexts/auth-context';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'message';
  imageUrl?: string | null;
  duration?: number;
  data?: PushNotificationData;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface NotificationsContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  markNotificationRead: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearAll: () => void;
  popupNotification: Notification | null;
  clearPopupNotification: () => void;
  pushToken: string;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);
const DISMISSED_STORAGE_PREFIX = '@nearhub_dismissed_notifications_';

type ServerNotification = {
  id?: string;
  title?: string;
  message?: string;
  type?: Notification['type'];
  imageUrl?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  category?: string | null;
  referenceId?: string | null;
  priority?: string | null;
  isRead?: boolean;
  createdAt?: string | null;
};

function buildNotificationData(notification: ServerNotification): PushNotificationData | undefined {
  const actionUrl = String(notification.actionUrl || '').trim();
  const referenceId = String(notification.referenceId || '').trim();
  const category = String(notification.category || '').trim();
  const title = String(notification.title || '').trim();
  const message = String(notification.message || '').trim();

  const data: PushNotificationData = {
    type: category || notification.type || 'info',
    listingId: referenceId && ['listing', 'deal'].includes(category) ? referenceId : undefined,
    actionUrl: actionUrl || undefined,
    url: actionUrl || undefined,
  };

  if (data.type === 'invoice' || data.type === 'payment' || /invoice/i.test(title + message)) {
    data.invoiceUrl = actionUrl || undefined;
  }

  if (!data.listingId && referenceId) {
    data.referenceId = referenceId;
  }

  return Object.values(data).some((value) => value !== undefined && value !== null)
    ? data
    : undefined;
}

function toLocalNotification(notification: ServerNotification): Notification | null {
  const title = String(notification.title || '').trim();
  const message = String(notification.message || '').trim();
  const id = String(notification.id || '').trim();
  if (!id || !title || !message) return null;

  const type = (notification.type || 'info') as Notification['type'];
  return {
    id,
    title,
    message,
    type,
    imageUrl: notification.imageUrl ?? undefined,
    duration: 6000,
    data: buildNotificationData(notification),
  };
}

function notificationSignature(notification: Notification): string {
  const data = notification.data || {};
  return [
    notification.title,
    notification.message,
    data.actionUrl || data.url || data.dealUrl || '',
    data.listingId || '',
    data.conversationId || '',
    data.invoiceUrl || '',
  ]
    .join('|')
    .toLowerCase();
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [remoteNotifications, setRemoteNotifications] = useState<Notification[]>([]);
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);
  const [dismissedSignatures, setDismissedSignatures] = useState<Set<string>>(new Set());
  const [popupNotification, setPopupNotification] = useState<Notification | null>(null);

  // Integrate push notifications
  const { expoPushToken, notification: pushNotification } = usePushNotifications();

  const dismissedStorageKey = useMemo(
    () => `${DISMISSED_STORAGE_PREFIX}${String(user?.id || 'guest')}`,
    [user?.id]
  );

  const loadDismissedSignatures = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(dismissedStorageKey);
      if (!stored) {
        setDismissedSignatures(new Set());
        return;
      }

      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setDismissedSignatures(
          new Set(parsed.filter((value): value is string => typeof value === 'string'))
        );
      }
    } catch {
      setDismissedSignatures(new Set());
    }
  }, [dismissedStorageKey]);

  const persistDismissedIds = useCallback(
    async (next: Set<string>) => {
      try {
        await AsyncStorage.setItem(dismissedStorageKey, JSON.stringify([...next]));
      } catch {
        // Ignore local persistence failures.
      }
    },
    [dismissedStorageKey]
  );

  const loadRemoteNotifications = useCallback(async () => {
    if (!user?.id) {
      setRemoteNotifications([]);
      return;
    }

    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/api/notifications?limit=50`, {
        headers: buildUserAuthHeaders({ id: user.id, phone: user.phone || '' }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: ServerNotification[];
      };

      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        return;
      }

      setRemoteNotifications(
        payload.data
          .map((item) => toLocalNotification(item))
          .filter((item): item is Notification => Boolean(item))
      );
    } catch {
      // Keep the current list if the server is unavailable.
    }
  }, [user?.id, user?.phone]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const completeNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration,
    };
    const isActionableNotification = Boolean(
      completeNotification.data?.actionUrl ||
      completeNotification.data?.url ||
      completeNotification.data?.dealUrl ||
      completeNotification.data?.listingId ||
      completeNotification.data?.conversationId
    );

    setLocalNotifications((prev) => [...prev, completeNotification]);
    if (completeNotification.type === 'message' || isActionableNotification) {
      setPopupNotification(completeNotification);
    }

    return id;
  }, []);

  const syncNotificationRead = useCallback(
    async (notification: Notification | null) => {
      if (!notification || !user?.id) return;

      try {
        const apiUrl = await getApiUrl();
        await fetch(`${apiUrl}/api/notifications/mark-read`, {
          method: 'POST',
          headers: buildUserAuthHeaders({ id: user.id, phone: user.phone || '' }),
          body: JSON.stringify({
            userId: user.id,
            notificationId: notification.id,
            title: notification.title,
            message: notification.message,
            actionUrl:
              notification.data?.actionUrl || notification.data?.url || notification.data?.dealUrl,
            category: notification.data?.category,
            referenceId: notification.data?.referenceId || notification.data?.listingId,
            type: notification.data?.type || notification.type,
          }),
        });
      } catch {
        // Ignore sync failures; the local UI should still behave normally.
      }
    },
    [user?.id, user?.phone]
  );

  const syncAllNotificationsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      const apiUrl = await getApiUrl();
      await fetch(`${apiUrl}/api/notifications/read-all`, {
        method: 'POST',
        headers: buildUserAuthHeaders({ id: user.id, phone: user.phone || '' }),
        body: JSON.stringify({ userId: user.id }),
      });
    } catch {
      // Ignore sync failures.
    }
  }, [user?.id, user?.phone]);

  const markNotificationRead = useCallback(
    (notification: Notification) => {
      void syncNotificationRead(notification);
    },
    [syncNotificationRead]
  );

  const removeNotification = useCallback(
    (id: string) => {
      const target =
        [...localNotifications, ...remoteNotifications].find(
          (notification) => notification.id === id
        ) || null;

      void syncNotificationRead(target);
      setLocalNotifications((prev) => prev.filter((n) => n.id !== id));
      setRemoteNotifications((prev) => prev.filter((n) => n.id !== id));
      setPopupNotification((current) => (current?.id === id ? null : current));
      setDismissedSignatures((prev) => {
        const next = new Set(prev);
        if (target) {
          next.add(notificationSignature(target));
        }
        void persistDismissedIds(next);
        return next;
      });
    },
    [localNotifications, persistDismissedIds, remoteNotifications]
  );

  const markAllNotificationsRead = useCallback(() => {
    void syncAllNotificationsRead();
  }, [syncAllNotificationsRead]);

  const clearAll = useCallback(() => {
    void syncAllNotificationsRead();
    setLocalNotifications([]);
    setRemoteNotifications([]);
    setPopupNotification(null);
    setDismissedSignatures((prev) => {
      const next = new Set(prev);
      [...remoteNotifications, ...localNotifications].forEach((notification) =>
        next.add(notificationSignature(notification))
      );
      void persistDismissedIds(next);
      return next;
    });
  }, [localNotifications, persistDismissedIds, remoteNotifications]);

  const clearPopupNotification = useCallback(() => {
    void syncNotificationRead(popupNotification);
    setPopupNotification(null);
  }, [popupNotification, syncNotificationRead]);

  useEffect(() => {
    void loadDismissedSignatures();
  }, [loadDismissedSignatures]);

  useEffect(() => {
    void loadRemoteNotifications();
  }, [loadRemoteNotifications]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadRemoteNotifications();
      }
    });
    return () => subscription.remove();
  }, [loadRemoteNotifications]);

  // When push notification arrives, add to in-app notifications
  useEffect(() => {
    if (pushNotification) {
      addNotification({
        title: pushNotification.title,
        message: pushNotification.body,
        type: pushNotification.data?.type === 'message' ? 'message' : 'info',
        duration: 6000, // Show push notifications longer
        data: pushNotification.data,
      });
    }
  }, [pushNotification, addNotification]);

  const notifications = useMemo(() => {
    const merged = new Map<string, Notification>();
    [...remoteNotifications, ...localNotifications]
      .filter((notification) => !dismissedSignatures.has(notificationSignature(notification)))
      .forEach((notification) => {
        merged.set(notificationSignature(notification), notification);
      });

    return [...merged.values()];
  }, [dismissedSignatures, localNotifications, remoteNotifications]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        addNotification,
        markNotificationRead,
        removeNotification,
        markAllNotificationsRead,
        clearAll,
        popupNotification,
        clearPopupNotification,
        pushToken: expoPushToken,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}
