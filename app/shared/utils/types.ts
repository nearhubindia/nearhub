export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  offerPrice?: number; // Optional discount/offer price
  priceUnit?: PriceUnit; // Unit for pricing (per sqft, per litre, per month, etc.)
  category: Category;
  images: string[]; // Up to 5 images
  imageHashes?: string[]; // SHA256 hashes for deduplication
  videos?: string[]; // Up to 5 video URLs
  sellerName: string;
  sellerPhone: string;
  location: {
    latitude: number;
    longitude: number;
    city: string;
  };
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  listingType: 'sell' | 'buy' | 'service' | 'job';
  status?: 'active' | 'sold' | 'pending';
  expiresAt?: string;
  createdAt: string;
  isSaved?: boolean;
  aiValidated?: boolean;
  isPaid?: boolean;
  pincode?: string;
  duration?: number; // Duration in days for paid listings (15, 45, 90, 180)
  sellerAvatar?: string;
}

export type PriceUnit =
  // Services
  | 'per sqft'
  | 'per hour'
  | 'per room'
  | 'per toilet'
  | 'per day'
  | 'per session'
  // Products
  | 'per unit'
  | 'per kg'
  | 'per litre'
  | 'per bucket'
  | 'per box'
  | 'per piece'
  // Jobs & Real Estate
  | 'per month'
  | 'per year'
  | 'one-time';

export const PRICE_UNITS: Record<string, PriceUnit[]> = {
  Services: ['per sqft', 'per hour', 'per room', 'per toilet', 'per day', 'per session'],
  Jobs: ['per month', 'per year', 'per hour', 'one-time'],
  'Real Estate': ['per month', 'per sqft', 'one-time'],
  Electronics: ['per unit', 'per piece'],
  Furniture: ['per unit', 'per piece'],
  Clothing: ['per piece'],
  'Home & Garden': ['per unit', 'per kg', 'per litre', 'per bucket', 'per box', 'per piece'],
  default: ['per unit', 'per piece'],
};

export type Category =
  | 'Electronics'
  | 'Vehicles'
  | 'Real Estate'
  | 'Jobs'
  | 'Services'
  | 'Furniture'
  | 'Clothing'
  | 'Home & Garden'
  | 'Sports'
  | 'Education'
  | 'Pets'
  | 'Other';

export const CATEGORIES: Category[] = [
  'Electronics',
  'Vehicles',
  'Real Estate',
  'Jobs',
  'Services',
  'Furniture',
  'Clothing',
  'Home & Garden',
  'Sports',
  'Education',
  'Pets',
  'Other',
];

export const CATEGORY_ICONS: Record<Category, { name: string; family: string }> = {
  Electronics: { name: 'smartphone', family: 'Feather' },
  Vehicles: { name: 'truck', family: 'Feather' },
  'Real Estate': { name: 'home', family: 'Feather' },
  Jobs: { name: 'briefcase', family: 'Feather' },
  Services: { name: 'tool', family: 'Feather' },
  Furniture: { name: 'grid', family: 'Feather' },
  Clothing: { name: 'shopping-bag', family: 'Feather' },
  'Home & Garden': { name: 'sun', family: 'Feather' },
  Sports: { name: 'activity', family: 'Feather' },
  Education: { name: 'book', family: 'Feather' },
  Pets: { name: 'heart', family: 'Feather' },
  Other: { name: 'more-horizontal', family: 'Feather' },
};

export const CONDITIONS = [
  { value: 'new' as const, label: 'New' },
  { value: 'like_new' as const, label: 'Like New' },
  { value: 'good' as const, label: 'Good' },
  { value: 'fair' as const, label: 'Fair' },
  { value: 'poor' as const, label: 'Poor' },
];

export interface ValidationResult {
  isValid: boolean;
  isAppropriate: boolean;
  matchesCategory: boolean;
  confidence: number;
  detectedItems: string[];
  suggestion: string;
  reason: string;
}
