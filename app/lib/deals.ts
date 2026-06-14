import type { Category, Listing } from '@/lib/types';

export type ProductStateFilter = 'all' | 'brand_new' | 'resale';

const NON_PRODUCT_CATEGORIES = new Set([
  'services',
  'freelance',
  'jobs',
  'business',
  'education',
  'health',
  'real estate',
  'rentals',
  'food',
  'travel',
  'events',
  'community',
]);

function toNumericPrice(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function hasValidOfferPrice(listing: Pick<Listing, 'price' | 'offerPrice'>): boolean {
  const price = toNumericPrice(listing.price);
  const offerPrice = toNumericPrice(listing.offerPrice);
  return offerPrice > 0 && price > 0 && offerPrice < price;
}

export function getDiscountPercent(listing: Pick<Listing, 'price' | 'offerPrice'>): number | null {
  const price = toNumericPrice(listing.price);
  const offerPrice = toNumericPrice(listing.offerPrice);
  if (offerPrice <= 0 || price <= 0 || offerPrice >= price) return null;

  return Math.max(1, Math.round(((price - offerPrice) / price) * 100));
}

export function isProductCategory(category: Category | 'All' | string): boolean {
  const normalized = String(category || '')
    .trim()
    .toLowerCase();
  return Boolean(normalized) && normalized !== 'all' && !NON_PRODUCT_CATEGORIES.has(normalized);
}

export function isProductListing(listing: Listing): boolean {
  const listingType = String(listing.listingType || '')
    .trim()
    .toLowerCase();
  if (listingType === 'service' || listingType === 'job') return false;
  return isProductCategory(listing.category);
}

export function isRestaurantDeal(listing: Listing): boolean {
  return listing.category === 'Food' && hasValidOfferPrice(listing);
}

export function isHotelDeal(listing: Listing): boolean {
  return listing.category === 'Travel' && hasValidOfferPrice(listing);
}

export function isNewProductDeal(listing: Listing): boolean {
  return isProductListing(listing) && listing.condition === 'new' && hasValidOfferPrice(listing);
}

export function matchesProductState(listing: Listing, filter: ProductStateFilter): boolean {
  if (!isProductListing(listing) || filter === 'all') {
    return true;
  }

  if (filter === 'brand_new') {
    return listing.condition === 'new';
  }

  return ['like_new', 'good', 'fair', 'poor'].includes(listing.condition);
}
