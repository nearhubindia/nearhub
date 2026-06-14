import { Platform } from 'react-native';

type AnalyticsModule = typeof import('@react-native-firebase/analytics').default;

let analyticsModulePromise: Promise<AnalyticsModule | null> | null = null;

async function getAnalyticsModule(): Promise<AnalyticsModule | null> {
  if (Platform.OS === 'web') return null;

  if (!analyticsModulePromise) {
    analyticsModulePromise = import('@react-native-firebase/analytics')
      .then((module) => module.default)
      .catch((error) => {
        console.warn('[Analytics] Firebase Analytics unavailable:', error);
        return null;
      });
  }

  return analyticsModulePromise;
}

function normalizeScreenName(pathname: string): string {
  if (!pathname || pathname === '/') return 'home';

  return pathname
    .replace(/^\//, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'unknown';
}

function normalizeEventParams(
  params?: Record<string, string | number | boolean | null | undefined>
): Record<string, string | number> {
  if (!params) return {};

  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, typeof value === 'boolean' ? String(value) : (value as string | number)])
  );
}

export async function initializeFirebaseAnalytics(): Promise<void> {
  const analytics = await getAnalyticsModule();
  if (!analytics) return;

  await analytics().setAnalyticsCollectionEnabled(true);
}

export async function setAnalyticsUser(user: {
  id: string;
  plan?: string;
  city?: string;
} | null): Promise<void> {
  const analytics = await getAnalyticsModule();
  if (!analytics) return;

  if (!user) {
    await analytics().setUserId(null);
    await analytics().setUserProperties({});
    return;
  }

  await analytics().setUserId(user.id);
  await analytics().setUserProperties({
    plan: user.plan || 'free',
    city: user.city || 'unknown',
  });
}

export async function trackScreenView(pathname: string): Promise<void> {
  const analytics = await getAnalyticsModule();
  if (!analytics) return;

  const screenName = normalizeScreenName(pathname);
  await analytics().logScreenView({
    screen_name: screenName,
    screen_class: screenName,
  });
}

export async function trackAnalyticsEvent(
  name: string,
  params?: Record<string, string | number | boolean | null | undefined>
): Promise<void> {
  const analytics = await getAnalyticsModule();
  if (!analytics) return;

  await analytics().logEvent(name, normalizeEventParams(params));
}

export async function trackLogin(method: 'otp' | 'profile_complete' = 'otp'): Promise<void> {
  await trackAnalyticsEvent('login', { method });
}

export async function trackSignUp(
  method: 'otp' | 'profile_complete' = 'profile_complete'
): Promise<void> {
  await trackAnalyticsEvent('sign_up', { method });
}

export async function trackSearchEvent(params: {
  searchTerm?: string;
  category?: string;
  location?: string;
}): Promise<void> {
  await trackAnalyticsEvent('search', {
    search_term: params.searchTerm || 'browse',
    category: params.category || 'all',
    location: params.location || 'unknown',
  });
}

export async function trackViewItem(params: {
  id: string;
  title?: string;
  category?: string;
  price?: number;
  listingType?: string;
  location?: string;
}): Promise<void> {
  await trackAnalyticsEvent('view_item', {
    currency: 'INR',
    value: params.price,
    item_id: params.id,
    item_name: params.title || 'Listing',
    item_category: params.category || 'uncategorized',
    item_variant: params.listingType || 'listing',
    location: params.location || 'unknown',
  });
}

export async function trackGenerateLead(params: {
  listingId: string;
  listingTitle?: string;
  method: 'chat' | 'call' | 'deal_booking';
  category?: string;
}): Promise<void> {
  await trackAnalyticsEvent('generate_lead', {
    currency: 'INR',
    value: 1,
    item_id: params.listingId,
    item_name: params.listingTitle || 'Listing',
    item_category: params.category || 'uncategorized',
    method: params.method,
  });
}

export async function trackCreateListingEvent(params: {
  listingId?: string;
  category?: string;
  listingType?: string;
  price?: number;
  mode?: 'listing' | 'deal';
}): Promise<void> {
  await trackAnalyticsEvent('create_listing', {
    item_id: params.listingId || 'pending',
    item_category: params.category || 'uncategorized',
    item_variant: params.listingType || params.mode || 'listing',
    value: params.price,
    currency: 'INR',
  });
}

export async function trackPurchaseEvent(params: {
  purchaseType: 'subscription' | 'deal' | 'boost' | 'renewal';
  transactionId?: string;
  value?: number;
  itemId?: string;
  itemName?: string;
  category?: string;
}): Promise<void> {
  await trackAnalyticsEvent('purchase', {
    transaction_id: params.transactionId || `${params.purchaseType}-${Date.now()}`,
    currency: 'INR',
    value: params.value,
    item_id: params.itemId || params.purchaseType,
    item_name: params.itemName || params.purchaseType,
    item_category: params.category || params.purchaseType,
    purchase_type: params.purchaseType,
  });
}
