import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getApiUrl } from '@/lib/query-client';
import { useAuth } from '@/shared/contexts/auth-context';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
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

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<ReceivedNotification | null>(null);
  const { user } = useAuth();

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token && user) {
          setExpoPushToken(token);
          // Send token to server
          sendTokenToServer(token, user.id);
        }
      })
      .catch((error) => {
        // Silently handle push notification errors (Firebase not configured)
        console.log('[Push] Push notifications not available:', error.message);
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

      // Handle navigation based on notification type
      handleNotificationNavigation(data as PushNotificationData);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);

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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        token,
        platform: Platform.OS,
        deviceId: Constants.deviceId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to register push token');
    }

    console.log('[Push] Token registered successfully');
  } catch (error) {
    console.error('[Push] Error registering token:', error);
  }
}

/**
 * Handle navigation based on notification data
 */
function handleNotificationNavigation(data: PushNotificationData): void {
  // Import router dynamically to avoid circular dependencies
  import('expo-router').then(({ router }) => {
    if (data?.type === 'new_listing' && data.listingId) {
      router.push({
        pathname: '/listing/[id]',
        params: { id: data.listingId },
      });
    } else if (data?.type === 'message' && data.conversationId) {
      router.push({
        pathname: '/chat/[listingId]',
        params: {
          listingId: data.conversationId,
          conversationId: data.conversationId,
        },
      });
    } else if (data?.url) {
      router.push(data.url);
    }
  });
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
