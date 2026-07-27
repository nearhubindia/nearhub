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
  mainCategory?: string | null;
  subCategory?: string | null;
  category?: string;
  location?: string;
  pincode?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  userId?: string;
  displayName?: string;
  mobileNumber?: string;
  contactPhone?: string;
  images?: string[];
  videos?: string[];
  createdAt?: string;
  featured?: boolean;
  isDeal?: boolean;
  dealType?: 'normal' | 'combo' | string | null;
  dealStartAt?: string | null;
  dealEndAt?: string | null;
  dealRecurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | string | null;
  dealRecurrenceUntil?: string | null;
  dealCycleQuantity?: number | null;
  maxDealBookings?: number | null;
  dealBookingsUsed?: number | null;
  purchaseLimitType?: 'ONE_TIME' | 'UNLIMITED' | string | null;
  comboItems?: string[] | string | null;
  dealTerms?: string | null;
  voucherEnabled?: boolean;
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

export interface AdminUserRow {
  id: string;
  username: string;
  displayName?: string;
  mobile?: string;
  autoDetectedLocation?: string;
  location?: string;
  listingsCount?: number;
  listings?: number;
  listingLocations?: string[];
  isVerified?: boolean;
}

export interface AdminSubscriptionTier {
  id?: string;
  name?: string;
  type?: string;
  description?: string;
  price?: string | number;
  offerPrice?: string | number | null;
  durationDays?: number;
  maxListings?: number;
  boostCredits?: number;
  features?: string[] | string;
  highlight?: boolean;
}

export interface AdminUserSubscription {
  id: string;
  userId: string;
  subscriptionTierId: string;
  status: string;
  expiresAt: string;
  subscribedAt?: string;
  updatedAt?: string;
  autoRenew?: boolean;
  boostsRemaining?: number;
  paymentId?: string | null;
  orderId?: string | null;
  invoiceId?: string | null;
  tier?: AdminSubscriptionTier | null;
}

export interface AdminUserDetail extends AdminUserRow {
  subscriptions?: AdminUserSubscription[];
}

export interface AdminUserWriteData {
  displayName?: string;
  username?: string;
  mobile: string;
  location: string;
  isVerified: boolean;
}

export interface AdminGrantSubscriptionData {
  tierId: string;
  durationDays?: number;
}

export interface AppScreenBanner {
  id: string;
  title: string;
  screen: 'home' | 'search' | 'profile' | 'listings';
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
