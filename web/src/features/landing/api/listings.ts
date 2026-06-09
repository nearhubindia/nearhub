import { getApiUrl } from '@/lib/config';

export type CreateListingRequest = {
  userId: string;
  title: string;
  description: string;
  mainCategory?: string;
  subCategory: string;
  category: string;
  price: number;
  offerPrice?: number;
  priceUnit?: string;
  condition?: string;
  location: string;
  pincode?: string;
  sellerName?: string;
  contactPhone?: string;
  images?: string[];
  videos?: string[];
  userSubscriptionId?: string;
  subscriptionTierId?: string;
  couponCode?: string;
  listingType?: 'image' | 'video' | 'mixed';
  featured?: boolean;
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
  attributes?: Record<string, string | number | boolean>;
};

export type CreateListingResponse = {
  success?: boolean;
  isFree?: boolean;
  requiresApproval?: boolean;
  message?: string;
  error?: string;
  code?: string;
  listing?: {
    id?: string;
    title?: string;
    price?: string | number;
    isPaid?: boolean;
    durationDays?: number;
    status?: string;
    createdAt?: string;
    expiresAt?: string | null;
  };
};

type CreateListingHeaders = {
  userId: string;
  userPhone?: string;
  token?: string;
};

function compactRequestBody(input: CreateListingRequest): CreateListingRequest {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    })
  ) as CreateListingRequest;
}

export async function createListing(
  input: CreateListingRequest,
  headers: CreateListingHeaders
): Promise<CreateListingResponse> {
  const response = await fetch(`${getApiUrl()}/api/subscriptions/create-listing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': headers.userId,
      'x-user-phone': headers.userPhone || '',
      ...(headers.token ? { Authorization: `Bearer ${headers.token}` } : {}),
    },
    body: JSON.stringify(compactRequestBody(input)),
  });

  const payload = (await response.json().catch(() => ({}))) as CreateListingResponse;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || 'Failed to create listing.');
  }

  return payload;
}
