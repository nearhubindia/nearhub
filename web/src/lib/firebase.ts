import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  logEvent,
  setUserId,
  setUserProperties,
  type Analytics,
} from 'firebase/analytics';
import {
  getMessaging,
  getToken,
  isSupported as isMessagingSupported,
  type Messaging,
} from 'firebase/messaging';
import { getApiUrl } from './config';

type WebAnalyticsUser = {
  id: string;
  plan?: string;
  city?: string;
  name?: string;
  phone?: string;
};

type EventParams = Record<string, string | number | boolean | null | undefined>;

type ListingEventPayload = {
  id: string;
  title?: string;
  category?: string;
  price?: number;
  listingType?: string;
  location?: string;
};

type PurchasePayload = {
  transactionId?: string;
  value?: number;
  currency?: string;
  itemId?: string;
  itemName?: string;
  category?: string;
  purchaseType: 'subscription' | 'deal' | 'boost' | 'renewal';
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBv0aD-mE3ahPDcQpEeZmMSUVWtM57_-vc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'nearhub-b8dd7.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nearhub-b8dd7',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'nearhub-b8dd7.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '822544369307',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:822544369307:web:e7ac97ee3f89c9a334283e',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-3RDDBXSGB0',
};

function normalizeWebPushVapidKey(value: string | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.replace(/\s+/g, '');
}

function base64UrlToUint8Array(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function isValidWebPushVapidKey(value: string | null): value is string {
  if (!value) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false;

  const decoded = base64UrlToUint8Array(value);
  return Boolean(decoded && decoded.length === 65);
}

const webPushVapidKey = normalizeWebPushVapidKey(
  import.meta.env.VITE_FIREBASE_WEB_PUSH_VAPID_KEY
);

let appInstance: FirebaseApp | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;
let registeredWebToken: string | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function getFirebaseApp(): FirebaseApp | null {
  if (!isBrowser()) return null;
  if (appInstance) return appInstance;
  appInstance = getApps()[0] || initializeApp(firebaseConfig);
  return appInstance;
}

function sanitizeEventParams(params?: EventParams): Record<string, string | number> {
  if (!params) return {};

  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [
        key,
        typeof value === 'boolean' ? String(value) : (value as string | number),
      ])
  );
}

export async function initializeWebAnalytics(): Promise<void> {
  if (!isBrowser()) return;

  if (!analyticsPromise) {
    analyticsPromise = isAnalyticsSupported()
      .then((supported) => (supported ? getAnalytics(getFirebaseApp()!) : null))
      .catch((error) => {
        console.warn('[Web Analytics] Firebase analytics unavailable:', error);
        return null;
      });
  }

  await analyticsPromise;
}

async function getAnalyticsInstance(): Promise<Analytics | null> {
  await initializeWebAnalytics();
  return analyticsPromise ? await analyticsPromise : null;
}

export async function trackWebEvent(name: string, params?: EventParams): Promise<void> {
  const normalized = sanitizeEventParams(params);
  const analytics = await getAnalyticsInstance();

  if (analytics) {
    logEvent(analytics, name, normalized);
    return;
  }

  if (isBrowser() && typeof window.gtag === 'function') {
    window.gtag('event', name, normalized);
  }
}

export async function trackWebPageView(pathname: string, search: string): Promise<void> {
  const path = `${pathname}${search || ''}` || '/';
  await trackWebEvent('page_view', {
    page_location: isBrowser() ? window.location.href : path,
    page_path: path,
    page_title: isBrowser() ? document.title : 'NearHub',
  });
}

export async function setWebAnalyticsUser(user: WebAnalyticsUser | null): Promise<void> {
  const analytics = await getAnalyticsInstance();

  if (!user) {
    if (analytics) {
      await setUserId(analytics, null);
      await setUserProperties(analytics, {});
    }
    return;
  }

  if (analytics) {
    await setUserId(analytics, user.id);
    await setUserProperties(analytics, {
      plan: user.plan || 'free',
      city: user.city || 'unknown',
    });
  }

  await trackWebEvent('login_state', {
    user_id: user.id,
    plan: user.plan || 'free',
    city: user.city || 'unknown',
  });
}

export async function trackWebLogin(method: 'otp' | 'profile_complete' = 'otp'): Promise<void> {
  await trackWebEvent('login', { method });
}

export async function trackWebSignUp(method: 'otp' | 'profile_complete' = 'otp'): Promise<void> {
  await trackWebEvent('sign_up', { method });
}

export async function trackWebSearch(params: {
  searchTerm?: string;
  category?: string;
  location?: string;
}): Promise<void> {
  await trackWebEvent('search', {
    search_term: params.searchTerm || 'browse',
    category: params.category || 'all',
    location: params.location || 'unknown',
  });
}

export async function trackWebViewItem(payload: ListingEventPayload): Promise<void> {
  await trackWebEvent('view_item', {
    currency: 'INR',
    value: payload.price,
    item_id: payload.id,
    item_name: payload.title || 'Listing',
    item_category: payload.category || 'uncategorized',
    item_variant: payload.listingType || 'listing',
    location: payload.location || 'unknown',
  });
}

export async function trackWebGenerateLead(payload: {
  listingId: string;
  listingTitle?: string;
  method: 'chat' | 'call' | 'deal_booking';
  category?: string;
}): Promise<void> {
  await trackWebEvent('generate_lead', {
    currency: 'INR',
    value: 1,
    item_id: payload.listingId,
    item_name: payload.listingTitle || 'Listing',
    item_category: payload.category || 'uncategorized',
    method: payload.method,
  });
}

export async function trackWebCreateListing(payload: {
  listingId?: string;
  category?: string;
  listingType?: string;
  price?: number;
  mode?: 'listing' | 'deal';
}): Promise<void> {
  await trackWebEvent('create_listing', {
    item_id: payload.listingId || 'pending',
    item_category: payload.category || 'uncategorized',
    item_variant: payload.listingType || payload.mode || 'listing',
    value: payload.price,
    currency: 'INR',
  });
}

export async function trackWebPurchase(payload: PurchasePayload): Promise<void> {
  await trackWebEvent('purchase', {
    transaction_id: payload.transactionId || `${payload.purchaseType}-${Date.now()}`,
    currency: payload.currency || 'INR',
    value: payload.value,
    item_id: payload.itemId || payload.purchaseType,
    item_name: payload.itemName || payload.purchaseType,
    item_category: payload.category || payload.purchaseType,
    purchase_type: payload.purchaseType,
  });
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (!isBrowser() || !('serviceWorker' in navigator)) return null;

  if (!messagingPromise) {
    messagingPromise = isMessagingSupported()
      .then((supported) => (supported ? getMessaging(getFirebaseApp()!) : null))
      .catch((error) => {
        console.warn('[Web Push] Firebase messaging unavailable:', error);
        return null;
      });
  }

  return messagingPromise;
}

export async function registerWebPushToken(user: {
  id: string;
  phone?: string;
  name?: string;
  notificationsEnabled?: boolean;
}): Promise<void> {
  if (!isBrowser() || !user.id || user.notificationsEnabled === false) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (Notification.permission === 'denied') return;

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission().catch(() => 'default');
  if (permission !== 'granted') return;

  const messaging = await getMessagingInstance();
  if (!messaging) return;

  if (!isValidWebPushVapidKey(webPushVapidKey)) {
    console.warn(
      '[Web Push] Skipping FCM token registration because VITE_FIREBASE_WEB_PUSH_VAPID_KEY is missing or invalid.'
    );
    return;
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messaging, {
    vapidKey: webPushVapidKey,
    serviceWorkerRegistration: registration,
  }).catch((error) => {
    console.warn('[Web Push] Failed to get FCM token:', error);
    return '';
  });

  if (!token || token === registeredWebToken) return;

  const response = await fetch(`${getApiUrl()}/api/push/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': user.id,
      ...(user.phone ? { 'x-user-phone': user.phone } : {}),
      ...(user.name ? { 'x-user-name': user.name } : {}),
    },
    body: JSON.stringify({
      userId: user.id,
      token,
      platform: 'web',
      deviceId: isBrowser() ? navigator.userAgent : 'web',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.warn('[Web Push] Failed to register FCM token:', response.status, errorText);
    return;
  }

  registeredWebToken = token;
}
