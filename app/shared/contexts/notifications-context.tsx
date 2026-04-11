import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  usePushNotifications,
  type PushNotificationData,
} from '@/shared/hooks/use-push-notifications';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'message';
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
  removeNotification: (id: string) => void;
  clearAll: () => void;
  popupNotification: Notification | null;
  clearPopupNotification: () => void;
  pushToken: string;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [popupNotification, setPopupNotification] = useState<Notification | null>(null);

  // Integrate push notifications
  const { expoPushToken, notification: pushNotification } = usePushNotifications();

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const completeNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration,
    };

    setNotifications((prev) => [...prev, completeNotification]);

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setPopupNotification((current) => (current?.id === id ? null : current));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setPopupNotification(null);
  }, []);

  const clearPopupNotification = useCallback(() => {
    setPopupNotification(null);
  }, []);

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

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
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
