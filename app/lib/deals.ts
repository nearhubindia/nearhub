import type { Category, Listing } from '@/lib/types';

export type ProductStateFilter = 'all' | 'brand_new' | 'resale';

const PRODUCT_CATEGORIES: Category[] = [
  'Electronics',
  'Mobiles',
  'Computers',
  'Appliances',
  'Vehicles',
  'Commercial Vehicles',
  'Bikes',
  'Spare Parts',
  'Furniture',
  'Fashion',
  'Clothing',
  'Beauty',
  'Kids',
  'Home & Garden',
  'Sports',
  'Books',
  'Pets Accessories',
  'Agriculture',
  'Pets',
  'Other',
];

function toNumericPrice(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function hasValidOfferPrice(listing: Pick<Listing, 'price' | 'offerPrice'>): boolean {
  const price = toNumericPrice(listing.price);
  const offerPrice = toNumericPrice(listing.offerPrice);
  return offerPrice > 0 && price > 0 && offerPrice < price;
}

export function isProductCategory(category: Category | 'All' | string): boolean {
  return PRODUCT_CATEGORIES.includes(category as Category);
}

export function isRestaurantDeal(listing: Listing): boolean {
  return listing.category === 'Food' && hasValidOfferPrice(listing);
}

export function isHotelDeal(listing: Listing): boolean {
  return listing.category === 'Travel' && hasValidOfferPrice(listing);
}

export function isNewProductDeal(listing: Listing): boolean {
  return isProductCategory(listing.category) && listing.condition === 'new' && hasValidOfferPrice(listing);
}

export function matchesProductState(listing: Listing, filter: ProductStateFilter): boolean {
  if (!isProductCategory(listing.category) || filter === 'all') {
    return true;
  }

  if (filter === 'brand_new') {
    return listing.condition === 'new';
  }

  return ['like_new', 'good', 'fair', 'poor'].includes(listing.condition);
}
