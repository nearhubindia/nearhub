import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { InteractionManager, Platform } from 'react-native';
import Constants from 'expo-constants';
import { getApiUrl } from '@/lib/query-client';
import { useAuth } from '@/shared/contexts/auth-context';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';
import { openNotificationTarget } from '@/lib/notification-navigation';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

export interface PushNotificationData {
  type?: string;
  listingId?: string;
  conversationId?: string;
  url?: string;
  [key: string]: any;
}

export interface ReceivedNotification {
  title: string;
  body: string;
  data?: PushNotificationData;
}

function isActionablePushData(data: unknown): data is PushNotificationData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const payload = data as Record<string, unknown>;
  return (
    typeof payload.type === 'string' ||
    typeof payload.listingId === 'string' ||
    typeof payload.conversationId === 'string' ||
    typeof payload.url === 'string'
  );
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<ReceivedNotification | null>(null);
  const { user } = useAuth();
  const pushEnabled = user?.preferences?.notifications !== false;

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const registerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || !pushEnabled) {
      setExpoPushToken('');
      setNotification(null);
      return;
    }

    let isCancelled = false;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      registerTimeoutRef.current = setTimeout(() => {
        if (isCancelled) return;

        registerForPushNotificationsAsync()
          .then((token) => {
            if (token && !isCancelled) {
              setExpoPushToken(token);
              // Send token to server
              void sendTokenToServer(token, userId);
            }
          })
          .catch((error) => {
            // Silently handle push notification errors (Firebase not configured)
            console.log('[Push] Push notifications not available:', error.message);
          });
      }, 900);
    });

    // Listen for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      setNotification({
        title: title || 'Notification',
        body: body || '',
        data: data as PushNotificationData,
      });
    });

    // Listen for user interactions with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const { data } = response.notification.request.content;
      console.log('[Push] Notification tapped:', data);

      if (!isActionablePushData(data)) {
        console.log('[Push] Ignoring non-app notification response payload');
        return;
      }

      // Handle navigation based on notification type
      void openNotificationTarget(data as PushNotificationData);
    });

    return () => {
      isCancelled = true;
      interactionTask.cancel();
      if (registerTimeoutRef.current) {
        clearTimeout(registerTimeoutRef.current);
        registerTimeoutRef.current = null;
      }
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
    };
  }, [pushEnabled, user?.id]);

  return {
    expoPushToken,
    notification,
  };
}

/**
 * Register for push notifications and get Expo push token
 */
async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });

    // Create additional channels for different notification types
    await Notifications.setNotificationChannelAsync('new_listing', {
      name: 'New Listings',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 100, 200, 100],
      sound: 'default',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push] Failed to get push notification permissions');
      return;
    }

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;

      if (!projectId) {
        console.warn('[Push] No EAS project ID found, skipping push notifications');
        return;
      }

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      console.log('[Push] Expo push token obtained:', token);
    } catch (error) {
      // Firebase not configured - this is expected if FCM credentials aren't set up
      if (error instanceof Error && error.message.includes('FirebaseApp')) {
        console.log('[Push] Firebase not configured. Push notifications disabled.');
        console.log(
          '[Push] To enable push notifications, follow: https://docs.expo.dev/push-notifications/fcm-credentials/'
        );
      } else {
        console.error('[Push] Error getting push token:', error);
      }
      return; // Return gracefully without token
    }
  } else {
    console.warn('[Push] Must use physical device for push notifications');
  }

  return token;
}

/**
 * Send push token to server
 */
async function sendTokenToServer(token: string, userId: string): Promise<void> {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/push/register`, {
      method: 'POST',
      headers: buildUserAuthHeaders({ id: userId }),
      body: JSON.stringify({
        userId,
        token,
        platform: Platform.OS,
        deviceId: Constants.deviceId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to register push token (${response.status}): ${errorText}`);
    }

    console.log('[Push] Token registered successfully');
  } catch (error) {
    console.error('[Push] Error registering token:', error);
  }
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: PushNotificationData,
  seconds: number = 1
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: 'default' as any,
    },
    trigger: { seconds } as any,
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}
