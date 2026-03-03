/**
 * Mock for expo-server-sdk to avoid ES module loading issues in Jest
 */

export const Expo = class MockExpo {
  static isExpoPushToken(token: string): boolean {
    return token.startsWith('ExponentPushToken[');
  }

  chunkPushNotifications(messages: any[]): any[] {
    return [messages];
  }

  async sendPushNotificationsAsync(messages: any[]): Promise<any[]> {
    return messages.map(() => ({
      status: 'ok',
      id: 'mock-ticket-id',
    }));
  }

  async getPushNotificationReceiptsAsync(ids: string[]): Promise<any> {
    return ids.reduce((acc, id) => {
      acc[id] = { status: 'ok' };
      return acc;
    }, {} as any);
  }
};

export interface ExpoPushMessage {
  to: string | string[];
  sound?: 'default' | null;
  body: string;
  data?: object;
  title?: string;
  subtitle?: string;
  badge?: number;
  channelId?: string;
  categoryId?: string;
  mutableContent?: boolean;
  ttl?: number;
  expiration?: number;
  priority?: 'default' | 'normal' | 'high';
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: any;
}

export interface ExpoPushErrorReceipt {
  status: 'error';
  message: string;
  details?: any;
}
