/**
 * Shared types for the admin feature
 */

export interface Stat {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  trend: string;
}

export interface Enhancements {
  featured: boolean;
  priority: boolean;
  verified: boolean;
  topSearch: boolean;
}

export interface Listing {
  id: string;
  title: string;
  price: string | number;
  offerPrice?: string | number;
  status: 'active' | 'sold' | 'pending' | 'rejected' | 'inactive' | 'expired';
  date: string;
  description?: string;
  condition?: string;
  category?: string;
  location?: string;
  userId?: string;
  displayName?: string;
  mobileNumber?: string;
  contactPhone?: string;
  images?: string[];
  videos?: string[];
  createdAt?: string;
  featured?: boolean;
  sponsored?: boolean;
  enhancements?: Enhancements;
  folderId?: number;
}

export interface EditingListing extends Listing {
  folderId: number;
}

export interface Folder {
  id: number;
  name: string;
  icon: string;
  listingsCount: number;
  listings: Listing[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  listings: number;
  status: 'active' | 'suspended';
  joined: string;
}

export interface AppScreenBanner {
  id: string;
  title: string;
  screen: 'home' | 'search' | 'profile' | 'shorts' | 'listings';
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BannerPayload {
  title: string;
  screen: AppScreenBanner['screen'];
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}
