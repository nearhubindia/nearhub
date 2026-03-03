import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePushNotifications } from '@/shared/hooks/use-push-notifications';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
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
  pushToken: string;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Integrate push notifications
  const { expoPushToken, notification: pushNotification } = usePushNotifications();

  // When push notification arrives, add to in-app notifications
  useEffect(() => {
    if (pushNotification) {
      addNotification({
        title: pushNotification.title,
        message: pushNotification.body,
        type: 'info',
        duration: 6000, // Show push notifications longer
      });
    }
  }, [pushNotification]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const completeNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration || 4000,
    };

    setNotifications((prev) => [...prev, completeNotification]);

    // Auto-remove after duration
    if (completeNotification.duration && completeNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, completeNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAll,
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
