import { normalizeDealListingRecord } from '@/lib/deal-normalizers';
import type { Listing } from '@/lib/types';

export function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseMediaArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  }
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [trimmed];
    return parsed.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  } catch {
    return [trimmed];
  }
}

export function parseStringArrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  }
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [trimmed];
    return parsed.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  } catch {
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function normalizeAppListingType(listing: any): Listing['listingType'] {
  const rawType =
    typeof listing?.listingType === 'string' ? listing.listingType.trim().toLowerCase() : '';
  if (rawType === 'sell' || rawType === 'buy' || rawType === 'service' || rawType === 'job') {
    return rawType;
  }

  const normalizedSubCategory = String(
    listing?.subCategory || listing?.subcategory || listing?.category || ''
  )
    .trim()
    .toLowerCase();
  if (normalizedSubCategory === 'jobs') return 'job';
  if (
    normalizedSubCategory === 'services' ||
    normalizedSubCategory === 'freelance' ||
    normalizedSubCategory === 'business' ||
    normalizedSubCategory === 'education' ||
    normalizedSubCategory === 'health'
  ) {
    return 'service';
  }

  const normalizedMainCategory = String(listing?.mainCategory || '')
    .trim()
    .toLowerCase();
  if (normalizedMainCategory === 'jobs & services') return 'service';

  return 'sell';
}

export type ListingNormalizerOptions = {
  normalizeMediaUrl?: (url: string) => string;
};

export function mapApiListing(listing: any, options: ListingNormalizerOptions = {}): Listing {
  const normalizeMediaUrl = options.normalizeMediaUrl ?? ((value: string) => value);
  const categoryValue = String(
    listing?.subCategory || listing?.subcategory || listing?.category || ''
  ).trim();
  const normalizedCategory = (categoryValue || 'Other') as Listing['category'];
  const latitude = toNumber(listing?.latitude, 0);
  const longitude = toNumber(listing?.longitude, 0);

  return {
    id: String(listing?.id || ''),
    userId: String(listing?.userId || listing?.sellerId || ''),
    title: String(listing?.title || ''),
    description: String(listing?.description || ''),
    price: toNumber(listing?.price, 0),
    offerPrice:
      listing?.offerPrice !== undefined && listing?.offerPrice !== null
        ? toNumber(listing.offerPrice, 0)
        : undefined,
    priceUnit:
      typeof listing?.priceUnit === 'string' && listing.priceUnit.trim()
        ? listing.priceUnit.trim()
        : undefined,
    mainCategory:
      typeof listing?.mainCategory === 'string' && listing.mainCategory.trim()
        ? listing.mainCategory.trim()
        : undefined,
    subCategory: normalizedCategory,
    subcategory: normalizedCategory,
    category: normalizedCategory,
    images: parseMediaArray(listing?.images).map(normalizeMediaUrl),
    videos: parseMediaArray(listing?.videos).map(normalizeMediaUrl),
    sellerName: String(listing?.sellerName || listing?.seller?.name || 'Seller').trim() || 'Seller',
    sellerVerified: Boolean(listing?.sellerVerified),
    sellerPhone: String(listing?.contactPhone || listing?.sellerPhone || '').trim(),
    contactPhone: String(listing?.contactPhone || listing?.sellerPhone || '').trim(),
    location: {
      latitude,
      longitude,
      city: String(listing?.location || listing?.city || 'Unknown').trim() || 'Unknown',
    },
    condition: (String(listing?.condition || 'good').trim() || 'good') as Listing['condition'],
    listingType: normalizeAppListingType(listing),
    status:
      typeof listing?.status === 'string' && listing.status.trim()
        ? (listing.status.trim() as Listing['status'])
        : undefined,
    rejectionReason:
      typeof listing?.rejectionReason === 'string' && listing.rejectionReason.trim()
        ? listing.rejectionReason.trim()
        : undefined,
    expiresAt:
      typeof listing?.expiresAt === 'string' && listing.expiresAt.trim()
        ? listing.expiresAt.trim()
        : undefined,
    createdAt: String(listing?.createdAt || new Date().toISOString()),
    aiValidated: Boolean(listing?.aiValidated),
    isPaid: Boolean(listing?.isPaid),
    featured: Boolean(listing?.featured),
    boostedUntil:
      typeof listing?.boostedUntil === 'string' && listing.boostedUntil.trim()
        ? listing.boostedUntil.trim()
        : undefined,
    boostCount:
      listing?.boostCount !== undefined && listing?.boostCount !== null
        ? toNumber(listing.boostCount, 0)
        : undefined,
    pincode: typeof listing?.pincode === 'string' ? listing.pincode.trim() : undefined,
    duration:
      listing?.duration !== undefined && listing?.duration !== null
        ? toNumber(listing.duration, 0)
        : undefined,
    durationDays:
      listing?.durationDays !== undefined && listing?.durationDays !== null
        ? toNumber(listing.durationDays, 0)
        : undefined,
    ...normalizeDealListingRecord(listing),
    sellerAvatar:
      typeof listing?.sellerAvatar === 'string' && listing.sellerAvatar.trim()
        ? normalizeMediaUrl(listing.sellerAvatar.trim())
        : '',
    viewCount:
      listing?.viewCount !== undefined && listing?.viewCount !== null
        ? toNumber(listing.viewCount, 0)
        : undefined,
    chatCount:
      listing?.chatCount !== undefined && listing?.chatCount !== null
        ? toNumber(listing.chatCount, 0)
        : undefined,
    likeCount:
      listing?.likeCount !== undefined && listing?.likeCount !== null
        ? toNumber(listing.likeCount, 0)
        : undefined,
    saveCount:
      listing?.saveCount !== undefined && listing?.saveCount !== null
        ? toNumber(listing.saveCount, 0)
        : undefined,
  };
}

export function normalizeListingForDetail(rawListing: Listing): Listing {
  const rawLocation = (rawListing as any)?.location;
  const normalizedLocation =
    rawLocation && typeof rawLocation === 'object'
      ? {
          latitude: toNumber((rawLocation as any).latitude, 0),
          longitude: toNumber((rawLocation as any).longitude, 0),
          city:
            typeof (rawLocation as any).city === 'string' && (rawLocation as any).city.trim()
              ? (rawLocation as any).city.trim()
              : 'Unknown',
        }
      : {
          latitude: toNumber((rawListing as any)?.latitude, 0),
          longitude: toNumber((rawListing as any)?.longitude, 0),
          city:
            typeof rawLocation === 'string' && rawLocation.trim() ? rawLocation.trim() : 'Unknown',
        };

  return {
    ...rawListing,
    title: String(rawListing?.title || '').trim(),
    description: String(rawListing?.description || ''),
    images: parseMediaArray((rawListing as any)?.images),
    videos: parseMediaArray((rawListing as any)?.videos),
    sellerName: String(rawListing?.sellerName || 'Seller').trim() || 'Seller',
    sellerAvatar:
      typeof rawListing?.sellerAvatar === 'string' ? rawListing.sellerAvatar.trim() : '',
    location: normalizedLocation,
    comboItems: parseStringArrayValue(
      (rawListing as any)?.comboItems ?? (rawListing as any)?.combo_items
    ),
  };
}
