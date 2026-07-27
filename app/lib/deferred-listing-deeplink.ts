import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { getInstallReferrer } from '@/lib/install-referrer';

const DEFERRED_REFERRER_HANDLED_KEY = '@nearhub_deferred_referrer_handled_v1';

function parseQueryString(value: string): URLSearchParams | null {
  const query = String(value || '')
    .trim()
    .replace(/^\?/, '');
  if (!query) return null;

  try {
    return new URLSearchParams(query);
  } catch {
    return null;
  }
}

function extractListingIdFromDeepLink(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';

  try {
    const url = new URL(value);
    const pathParts = String(url.pathname || '')
      .split('/')
      .filter(Boolean);

    if (url.hostname.toLowerCase() === 'listing' && pathParts.length > 0) {
      return decodeURIComponent(pathParts[0] || '').trim();
    }

    if (pathParts.length >= 2 && pathParts[0].toLowerCase() === 'listing') {
      return decodeURIComponent(pathParts[1] || '').trim();
    }
  } catch {
    // ignore parse errors and continue fallback parsing
  }

  const normalized = value
    .replace(/^nearhub:\/\//i, '/')
    .replace(/^https?:\/\/[^/]+/i, '')
    .split('?')[0]
    .split('#')[0];
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0].toLowerCase() === 'listing') {
    return decodeURIComponent(parts[1] || '').trim();
  }
  return '';
}

function parseListingIdFromInstallReferrer(referrer: string): string {
  const params = parseQueryString(referrer);
  if (!params) return '';

  const directListingId = String(
    params.get('nearhub_listing_id') || params.get('listing_id') || params.get('listingId') || ''
  ).trim();
  if (directListingId) {
    try {
      return decodeURIComponent(directListingId);
    } catch {
      return directListingId;
    }
  }

  const deepLink = String(params.get('deep_link') || params.get('link') || '').trim();
  if (deepLink) {
    return extractListingIdFromDeepLink(deepLink);
  }

  return '';
}

export async function maybeHandleDeferredListingDeepLink(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const installReferrer = await getInstallReferrer();
  if (!installReferrer) return false;

  const alreadyHandledReferrer = await AsyncStorage.getItem(DEFERRED_REFERRER_HANDLED_KEY);
  if (alreadyHandledReferrer === installReferrer) {
    return false;
  }

  const listingId = parseListingIdFromInstallReferrer(installReferrer);
  if (!listingId) {
    await AsyncStorage.setItem(DEFERRED_REFERRER_HANDLED_KEY, installReferrer);
    return false;
  }

  await AsyncStorage.setItem(DEFERRED_REFERRER_HANDLED_KEY, installReferrer);
  router.replace({ pathname: '/listing/[id]', params: { id: listingId } });
  return true;
}
