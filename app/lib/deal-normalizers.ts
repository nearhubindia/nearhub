import type { DealBooking, DealVoucherPayload } from '@/lib/deal-bookings';
import type { Listing } from '@/lib/types';

function getString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function getNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function getBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null || value === '') continue;
    return Boolean(value);
  }
  return undefined;
}

function getStringArray(record: Record<string, unknown>, keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      const items = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean);
      if (items.length > 0) {
        return items;
      }
    }
  }
  return undefined;
}

export function normalizeDealListingLocation(listing: unknown): Listing['location'] {
  const record = listing && typeof listing === 'object' ? (listing as Record<string, unknown>) : {};
  const rawLocation = record.location;
  const locationRecord =
    rawLocation && typeof rawLocation === 'object'
      ? (rawLocation as Record<string, unknown>)
      : undefined;

  const latitude =
    getNumber(record, ['latitude']) ?? getNumber(locationRecord || {}, ['latitude']) ?? 0;
  const longitude =
    getNumber(record, ['longitude']) ?? getNumber(locationRecord || {}, ['longitude']) ?? 0;
  const city =
    getString(locationRecord || {}, ['city']) ??
    getString(record, ['city']) ??
    (typeof rawLocation === 'string' && rawLocation.trim() ? rawLocation.trim() : undefined) ??
    'Unknown';

  return {
    latitude,
    longitude,
    city,
  };
}

export function normalizeDealListingRecord(listing: any): Partial<Listing> {
  if (!listing || typeof listing !== 'object') return {};
  const record = listing as Record<string, unknown>;

  return {
    isDeal: getBoolean(record, ['isDeal', 'is_deal']),
    dealType: getString(record, ['dealType', 'deal_type']) as Listing['dealType'],
    dealStartAt: getString(record, ['dealStartAt', 'deal_start_at']),
    dealEndAt: getString(record, ['dealEndAt', 'deal_end_at']),
    dealRecurrence: getString(record, [
      'dealRecurrence',
      'deal_recurrence',
    ]) as Listing['dealRecurrence'],
    dealRecurrenceUntil: getString(record, ['dealRecurrenceUntil', 'deal_recurrence_until']),
    dealCycleQuantity: getNumber(record, ['dealCycleQuantity', 'deal_cycle_quantity']),
    maxDealBookings: getNumber(record, ['maxDealBookings', 'max_deal_bookings']),
    purchaseLimitType: getString(record, ['purchaseLimitType', 'purchase_limit_type']) as
      | Listing['purchaseLimitType']
      | undefined,
    postDealPriceMode: getString(record, ['postDealPriceMode', 'post_deal_price_mode']) as
      | Listing['postDealPriceMode']
      | undefined,
    postDealDiscountPrice: getNumber(record, ['postDealDiscountPrice', 'post_deal_discount_price']),
    comboItems: getStringArray(record, ['comboItems', 'combo_items']),
    dealTerms: getString(record, ['dealTerms', 'deal_terms']),
    voucherEnabled: getBoolean(record, ['voucherEnabled', 'voucher_enabled']),
  };
}

export function normalizeDealVoucherPayload(
  value: DealBooking['voucherPayload']
): DealVoucherPayload {
  if (!value) return {};

  const raw =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        })()
      : value;

  if (!raw || typeof raw !== 'object') return {};
  const record = raw as Record<string, unknown>;
  return {
    listingTitle: getString(record, ['listingTitle', 'listing_title']),
    listingImage: getString(record, ['listingImage', 'listing_image']),
    listingImages: getStringArray(record, ['listingImages', 'listing_images']),
    bookedAt: getString(record, ['bookedAt', 'booked_at']),
    dealStartAt: getString(record, ['dealStartAt', 'deal_start_at']),
    dealEndAt: getString(record, ['dealEndAt', 'deal_end_at']),
    comboItems: getStringArray(record, ['comboItems', 'combo_items']),
    terms: getString(record, ['terms', 'deal_terms']),
    category: getString(record, ['category']),
    location: getString(record, ['location']),
    price: getNumber(record, ['price']),
    offerPrice: getNumber(record, ['offerPrice', 'offer_price']),
  };
}

export function normalizeDealBookingRecord(value: any): DealBooking {
  if (!value || typeof value !== 'object') {
    return value as DealBooking;
  }

  const record = value as Record<string, unknown>;
  return {
    id: String(record.id || ''),
    listingId: String(record.listingId || record.listing_id || ''),
    dealCycleKey: getString(record, ['dealCycleKey', 'deal_cycle_key']) || null,
    buyerId: String(record.buyerId || record.buyer_id || ''),
    sellerId: String(record.sellerId || record.seller_id || ''),
    status: String(record.status || 'booked'),
    voucherCode: getString(record, ['voucherCode', 'voucher_code']) || null,
    voucherPayload: (record.voucherPayload ??
      record.voucher_payload ??
      null) as DealBooking['voucherPayload'],
    bookedAt: getString(record, ['bookedAt', 'booked_at']) || null,
    redeemedAt: getString(record, ['redeemedAt', 'redeemed_at']) || null,
    createdAt: getString(record, ['createdAt', 'created_at']) || null,
    updatedAt: getString(record, ['updatedAt', 'updated_at']) || null,
    listingTitle: getString(record, ['listingTitle', 'listing_title']) || null,
  };
}
