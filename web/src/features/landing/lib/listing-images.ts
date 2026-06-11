export const FALLBACK_LISTING_IMAGE = '/nearhub.png';

const PLACEHOLDER_IMAGE_PATHS = new Set([
  FALLBACK_LISTING_IMAGE,
  'nearhub.png',
  '/nearhub-logo.png',
  'nearhub-logo.png',
]);

type ListingImageSource = {
  images?: unknown;
  image?: unknown;
  imageUrl?: unknown;
  productImage?: unknown;
  productImageUrl?: unknown;
  thumbnail?: unknown;
  thumbnailUrl?: unknown;
};

function normalizeStoredImageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('/') ||
    raw.startsWith('data:')
  ) {
    return raw;
  }
  if (/^(?:uploads|images|listing-images|media)\//i.test(raw)) {
    return `/${raw}`;
  }
  return raw;
}

function isPlaceholderListingImage(value: string): boolean {
  const raw = value.trim();
  if (!raw) return true;
  if (PLACEHOLDER_IMAGE_PATHS.has(raw)) return true;

  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://nearhub.in';
    const parsed = new URL(raw, base);
    return PLACEHOLDER_IMAGE_PATHS.has(parsed.pathname);
  } catch {
    return false;
  }
}

function getImageUrlFromObject(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return (
    normalizeStoredImageUrl(record.url) ||
    normalizeStoredImageUrl(record.publicUrl) ||
    normalizeStoredImageUrl(record.imageUrl) ||
    normalizeStoredImageUrl(record.src) ||
    normalizeStoredImageUrl(record.path)
  );
}

function parseImageArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeStoredImageUrl(item) || getImageUrlFromObject(item))
      .filter(Boolean);
  }
  const objectUrl = getImageUrlFromObject(value);
  if (objectUrl) return [objectUrl];
  if (typeof value !== 'string') return [];

  const raw = value.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parseImageArray(parsed);
    const parsedObjectUrl = getImageUrlFromObject(parsed);
    if (parsedObjectUrl) return [parsedObjectUrl];
  } catch {
    if (raw.startsWith('{') && raw.endsWith('}')) {
      const inner = raw.slice(1, -1).trim();
      if (!inner) return [];
      return inner
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((item) =>
          item
            .trim()
            .replace(/^"(.*)"$/, '$1')
            .replace(/\\"/g, '"')
            .trim()
        )
        .filter(Boolean);
    }
  }

  return [raw];
}

export function getListingImages(listing: ListingImageSource): string[] {
  const images = [
    ...parseImageArray(listing.images),
    normalizeStoredImageUrl(listing.image),
    normalizeStoredImageUrl(listing.imageUrl),
    normalizeStoredImageUrl(listing.productImage),
    normalizeStoredImageUrl(listing.productImageUrl),
    normalizeStoredImageUrl(listing.thumbnail),
    normalizeStoredImageUrl(listing.thumbnailUrl),
  ].filter((image) => image && !isPlaceholderListingImage(image));

  return [...new Set(images)];
}

export function getPrimaryListingImage(listing: ListingImageSource): string {
  return getListingImages(listing)[0] || FALLBACK_LISTING_IMAGE;
}
