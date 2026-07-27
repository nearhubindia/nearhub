function normalizeRawPath(rawPath: string): string {
  const trimmed = String(rawPath || '').trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);

    // nearhub://listing/<id> (custom scheme)
    if ((url.protocol === 'nearhub:' || url.protocol === 'com.synvide.nearhub:') && url.hostname) {
      if (url.hostname.toLowerCase() === 'listing') {
        const customListingIdFromPath = decodeURIComponent(url.pathname.replace(/^\/+/, '')).trim();
        if (customListingIdFromPath) {
          return `/listing/${encodeURIComponent(customListingIdFromPath)}`;
        }

        const customListingIdFromQuery = decodeURIComponent(
          String(url.searchParams.get('id') || '')
        ).trim();
        if (customListingIdFromQuery) {
          return `/listing/${encodeURIComponent(customListingIdFromQuery)}`;
        }
      }
      if (url.hostname.toLowerCase() === 'subscriptions') {
        return `/subscriptions${url.search || ''}`;
      }
    }

    // https://nearhub.in/listing/<id> (app link)
    if (url.pathname) {
      return `${url.pathname}${url.search || ''}`;
    }
  } catch {
    // Not a full URL; continue with raw path.
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function extractListingPath(pathname: string): string | null {
  const cleanPath = String(pathname || '')
    .split('?')[0]
    .split('#')[0]
    .trim();
  if (!cleanPath) return null;

  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0].toLowerCase() !== 'listing') return null;

  const listingId = decodeURIComponent(parts[1] || '').trim();
  if (!listingId) return null;

  return `/listing/${encodeURIComponent(listingId)}`;
}

function extractSubscriptionsPath(pathname: string): string | null {
  const trimmed = String(pathname || '')
    .split('#')[0]
    .trim();
  if (!trimmed) return null;

  const [cleanPath, query = ''] = trimmed.split('?');
  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0].toLowerCase() !== 'subscriptions') return null;

  return query ? `/subscriptions?${query}` : '/subscriptions';
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const normalizedPath = normalizeRawPath(path);
  const listingPath = extractListingPath(normalizedPath);
  if (listingPath) {
    return listingPath;
  }
  const subscriptionsPath = extractSubscriptionsPath(normalizedPath);
  if (subscriptionsPath) {
    return subscriptionsPath;
  }

  return '/';
}
