import Colors from '@/constants/colors';

export interface Listing {
  userId?: string;
  id: string;
  title: string;
  description: string;
  price: number;
  offerPrice?: number; // Optional discount/offer price
  priceUnit?: PriceUnit; // Unit for pricing (per sqft, per litre, per month, etc.)
  mainCategory?: string; // Top-level grouping (e.g. "Electronics & Appliances")
  subCategory?: Category; // Explicit subcategory for new taxonomy model
  subcategory?: Category; // Backward/alternate casing from APIs
  category: Category;
  images: string[]; // Up to 5 images
  imageHashes?: string[]; // SHA256 hashes for deduplication
  videos?: string[]; // Up to 5 video URLs
  sellerName: string;
  sellerVerified?: boolean;
  sellerPhone: string;
  contactPhone?: string;
  location: {
    latitude: number;
    longitude: number;
    city: string;
  };
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  listingType: 'sell' | 'buy' | 'service' | 'job';
  status?: 'active' | 'sold' | 'pending' | 'rejected' | 'inactive' | 'expired';
  rejectionReason?: string;
  expiresAt?: string;
  createdAt: string;
  isSaved?: boolean;
  aiValidated?: boolean;
  isPaid?: boolean;
  featured?: boolean;
  sponsored?: boolean;
  boostedUntil?: string;
  boostCount?: number;
  pincode?: string;
  duration?: number; // Duration in days for paid listings (15, 45, 90, 180)
  durationDays?: number; // Server-side canonical duration field
  isDeal?: boolean;
  dealType?: 'normal' | 'combo';
  dealStartAt?: string;
  dealEndAt?: string;
  dealRecurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  dealRecurrenceUntil?: string;
  dealCycleQuantity?: number;
  maxDealBookings?: number;
  postDealPriceMode?: 'original' | 'discount';
  postDealDiscountPrice?: number;
  comboItems?: string[];
  dealTerms?: string;
  voucherEnabled?: boolean;
  sellerAvatar?: string;
  viewCount?: number; // Total views for analytics
  chatCount?: number; // Total chat conversations for this listing
  likeCount?: number; // Optional server-provided likes/saves metric
  saveCount?: number; // Optional server-provided saves metric
}

export type PriceUnit = string;

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

export type Category = string;

export const CATEGORIES: Category[] = [
  'Electronics',
  'Mobiles',
  'Computers',
  'Appliances',
  'Vehicles',
  'EV Vehicles',
  'Commercial Vehicles',
  'Bikes',
  'Spare Parts',
  'Real Estate',
  'Rentals',
  'Jobs',
  'Freelance',
  'Services',
  'Furniture',
  'Fashion',
  'Clothing',
  'Beauty',
  'Kids',
  'Home & Garden',
  'Sports',
  'Books',
  'Education',
  'Health',
  'Travel',
  'Events',
  'Food',
  'Pets Accessories',
  'Agriculture',
  'Business',
  'Community',
  'Pets',
  'Other',
];

export const CATEGORY_ICONS: Record<string, { name: string; family: string }> = {
  Electronics: { name: 'smartphone', family: 'Feather' },
  Mobiles: { name: 'smartphone', family: 'Feather' },
  Computers: { name: 'monitor', family: 'Feather' },
  Appliances: { name: 'cpu', family: 'Feather' },
  Vehicles: { name: 'truck', family: 'Feather' },
  'EV Vehicles': { name: 'zap', family: 'Feather' },
  'Commercial Vehicles': { name: 'truck', family: 'Feather' },
  Bikes: { name: 'disc', family: 'Feather' },
  'Spare Parts': { name: 'settings', family: 'Feather' },
  'Real Estate': { name: 'map', family: 'Feather' },
  Rentals: { name: 'key', family: 'Feather' },
  Jobs: { name: 'briefcase', family: 'Feather' },
  Freelance: { name: 'edit-3', family: 'Feather' },
  Services: { name: 'tool', family: 'Feather' },
  Furniture: { name: 'archive', family: 'Feather' },
  Fashion: { name: 'tag', family: 'Feather' },
  Clothing: { name: 'shopping-bag', family: 'Feather' },
  Beauty: { name: 'heart', family: 'Feather' },
  Kids: { name: 'smile', family: 'Feather' },
  'Home & Garden': { name: 'home', family: 'Feather' },
  Sports: { name: 'activity', family: 'Feather' },
  Books: { name: 'book-open', family: 'Feather' },
  Education: { name: 'book', family: 'Feather' },
  Health: { name: 'shield', family: 'Feather' },
  Travel: { name: 'compass', family: 'Feather' },
  Events: { name: 'calendar', family: 'Feather' },
  Food: { name: 'coffee', family: 'Feather' },
  'Pets Accessories': { name: 'shopping-cart', family: 'Feather' },
  Agriculture: { name: 'droplet', family: 'Feather' },
  Business: { name: 'briefcase', family: 'Feather' },
  Community: { name: 'users', family: 'Feather' },
  Pets: { name: 'heart', family: 'Feather' },
  Other: { name: 'more-horizontal', family: 'Feather' },
};

export const CATEGORY_COLORS: Record<string, string> = {
  Electronics: Colors.categoryElectronics,
  Mobiles: Colors.primary,
  Computers: Colors.primaryDark,
  Appliances: Colors.primaryLight,
  Vehicles: Colors.categoryVehicles,
  'EV Vehicles': Colors.categoryVehicles,
  'Commercial Vehicles': Colors.categoryVehicles,
  Bikes: Colors.accent,
  'Spare Parts': Colors.textSecondary,
  'Real Estate': Colors.categoryHome,
  Rentals: Colors.success,
  Jobs: Colors.categorySports,
  Freelance: Colors.warning,
  Services: Colors.primary,
  Furniture: Colors.categoryFurniture,
  Fashion: Colors.categoryClothing,
  Clothing: Colors.categoryClothing,
  Beauty: Colors.accent,
  Kids: Colors.accentLight,
  'Home & Garden': Colors.categoryHome,
  Sports: Colors.categorySports,
  Books: Colors.primaryDark,
  Education: Colors.primaryLight,
  Health: Colors.success,
  Travel: Colors.categoryVehicles,
  Events: Colors.warning,
  Food: Colors.accent,
  'Pets Accessories': Colors.categoryOther,
  Agriculture: Colors.categoryHome,
  Business: Colors.primary,
  Community: Colors.textSecondary,
  Pets: Colors.categoryClothing,
  Other: Colors.categoryOther,
};

export const CATEGORY_PICTURES: Record<string, string> = {
  Electronics: '📱',
  Mobiles: '📲',
  Computers: '💻',
  Appliances: '🧊',
  Vehicles: '🚗',
  'EV Vehicles': '🔋',
  'Commercial Vehicles': '🚚',
  Bikes: '🏍️',
  'Spare Parts': '⚙️',
  'Real Estate': '🏠',
  Rentals: '🔑',
  Jobs: '💼',
  Freelance: '🧑‍💻',
  Services: '🛠️',
  Furniture: '🛋️',
  Fashion: '👜',
  Clothing: '👕',
  Beauty: '💄',
  Kids: '🧸',
  'Home & Garden': '🌿',
  Sports: '⚽',
  Books: '📚',
  Education: '🎓',
  Health: '🩺',
  Travel: '✈️',
  Events: '🎉',
  Food: '🍔',
  'Pets Accessories': '🦴',
  Agriculture: '🌾',
  Business: '📈',
  Community: '👥',
  Pets: '🐶',
  Other: '📦',
};

export const CATEGORY_PICTURE_IMAGES: Record<string, string> = {
  Electronics: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4f1.png',
  Mobiles: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4f2.png',
  Computers: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4bb.png',
  Appliances: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f9ca.png',
  Vehicles: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f697.png',
  'EV Vehicles': 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f50b.png',
  'Commercial Vehicles':
    'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f69a.png',
  Bikes: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3cd-fe0f.png',
  'Spare Parts': 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2699-fe0f.png',
  'Real Estate': 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3e0.png',
  Rentals: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f511.png',
  Jobs: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4bc.png',
  Freelance: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f9d1-200d-1f4bb.png',
  Services: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f6e0-fe0f.png',
  Furniture: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f6cb-fe0f.png',
  Fashion: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f45c.png',
  Clothing: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f455.png',
  Beauty: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f484.png',
  Kids: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f9f8.png',
  'Home & Garden': 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f33f.png',
  Sports: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/26bd.png',
  Books: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4da.png',
  Education: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f393.png',
  Health: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1fa7a.png',
  Travel: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2708-fe0f.png',
  Events: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f389.png',
  Food: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f354.png',
  'Pets Accessories': 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f9b4.png',
  Agriculture: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f33e.png',
  Business: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4c8.png',
  Community: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f465.png',
  Pets: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f436.png',
  Other: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4e6.png',
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
