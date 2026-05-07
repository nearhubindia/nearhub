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
    }

    // https://nearhub.in/listing/<id> (app link)
    if (url.pathname) {
      return url.pathname;
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

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const normalizedPath = normalizeRawPath(path);
  const listingPath = extractListingPath(normalizedPath);
  if (listingPath) {
    return listingPath;
  }

  return '/';
}
