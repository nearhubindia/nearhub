export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: Category;
  images: string[];
  videoUrl?: string;
  sellerName: string;
  sellerPhone: string;
  location: {
    latitude: number;
    longitude: number;
    city: string;
  };
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  listingType: 'sell' | 'buy';
  createdAt: string;
  isSaved?: boolean;
  aiValidated?: boolean;
}

export type Category =
  | 'Electronics'
  | 'Vehicles'
  | 'Furniture'
  | 'Clothing'
  | 'Home & Garden'
  | 'Sports'
  | 'Other';

export const CATEGORIES: Category[] = [
  'Electronics',
  'Vehicles',
  'Furniture',
  'Clothing',
  'Home & Garden',
  'Sports',
  'Other',
];

export const CATEGORY_ICONS: Record<Category, { name: string; family: string }> = {
  Electronics: { name: 'laptop', family: 'Feather' },
  Vehicles: { name: 'truck', family: 'Feather' },
  Furniture: { name: 'grid', family: 'Feather' },
  Clothing: { name: 'shopping-bag', family: 'Feather' },
  'Home & Garden': { name: 'home', family: 'Feather' },
  Sports: { name: 'activity', family: 'Feather' },
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
