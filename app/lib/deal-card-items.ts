import { formatDealStatus, getEffectiveDealWindow, isDealActiveNow } from '@/lib/deal-timer';
import {
  calculateBestDistance,
  formatDistanceAway,
  hasMeaningfulCoordinates,
} from '@/lib/location-data';
import type { Listing } from '@/lib/types';

export type DealCardItem = {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  image: string;
  images: string[];
  location: string;
  distance: string;
  sortDistanceKm?: number;
  dealEndsAt?: number;
  dealStatus: string;
  comboItems?: string[];
  badge?: string;
  voucherEnabled?: boolean;
  dealType?: string;
};

function formatDealLocationLabel(city?: string): string {
  const trimmed = typeof city === 'string' ? city.trim() : '';
  return trimmed || 'Location unavailable';
}

export function createDealCardItem(
  item: Listing,
  nowMs: number,
  sourceCoords?: { latitude: number; longitude: number } | null
): DealCardItem {
  const window = getEffectiveDealWindow(item, nowMs);
  const distanceKm =
    sourceCoords &&
    hasMeaningfulCoordinates(sourceCoords.latitude, sourceCoords.longitude) &&
    hasMeaningfulCoordinates(item.location.latitude, item.location.longitude)
      ? calculateBestDistance(
          sourceCoords.latitude,
          sourceCoords.longitude,
          item.location.latitude,
          item.location.longitude
        )
      : undefined;
  const regularPrice = Number(item.price) || 0;
  const offerPrice = Number(item.offerPrice);
  const hasValidOfferPrice =
    Number.isFinite(offerPrice) && offerPrice > 0 && regularPrice > 0 && offerPrice < regularPrice;
  const displayPrice = hasValidOfferPrice ? offerPrice : regularPrice;
  const originalPrice = hasValidOfferPrice ? regularPrice : undefined;

  return {
    id: item.id,
    title: item.title,
    price: displayPrice,
    originalPrice,
    image: item.images[0] || '',
    images: item.images || [],
    location: formatDealLocationLabel(item.location.city),
    distance:
      typeof distanceKm === 'number'
        ? formatDistanceAway(distanceKm)
        : formatDealLocationLabel(item.location.city),
    sortDistanceKm: distanceKm,
    dealEndsAt: window?.endMs,
    dealStatus: formatDealStatus(item, nowMs),
    comboItems: item.comboItems,
    badge: isDealActiveNow(item, nowMs) ? 'Deal' : undefined,
    voucherEnabled: item.voucherEnabled,
    dealType: item.dealType,
  };
}

export function sortDealItemsByDistance<T extends { sortDistanceKm?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const distanceA =
      typeof a.sortDistanceKm === 'number' && Number.isFinite(a.sortDistanceKm)
        ? a.sortDistanceKm
        : Number.POSITIVE_INFINITY;
    const distanceB =
      typeof b.sortDistanceKm === 'number' && Number.isFinite(b.sortDistanceKm)
        ? b.sortDistanceKm
        : Number.POSITIVE_INFINITY;
    return distanceA - distanceB;
  });
}
