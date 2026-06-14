import { getBackendURL } from '@/lib/config';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';

export type DealBooking = {
  id: string;
  listingId: string;
  dealCycleKey?: string | null;
  buyerId: string;
  sellerId: string;
  status: 'booked' | 'redeemed' | 'cancelled' | 'expired' | string;
  voucherCode?: string | null;
  voucherPayload?: string | Record<string, unknown> | null;
  bookedAt?: string | null;
  redeemedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  listingTitle?: string | null;
};

type BookingResponse = {
  success?: boolean;
  booking?: DealBooking;
  bookings?: DealBooking[];
  voucherViewUrl?: string;
  error?: string;
  message?: string;
};

export async function bookDeal(listingId: string, userId: string, userPhone?: string) {
  const backendURL = getBackendURL();
  const response = await fetch(`${backendURL}/api/deals/${encodeURIComponent(listingId)}/book`, {
    method: 'POST',
    headers: buildUserAuthHeaders({ id: userId, phone: userPhone }),
  });

  const payload = (await response.json().catch(() => ({}))) as BookingResponse;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || 'Failed to book deal');
  }

  return payload;
}

export async function fetchMyDealBookings(userId: string, userPhone?: string) {
  const backendURL = getBackendURL();
  const response = await fetch(`${backendURL}/api/deals/my-bookings`, {
    method: 'GET',
    headers: buildUserAuthHeaders({ id: userId, phone: userPhone }),
  });

  const payload = (await response.json().catch(() => ({}))) as BookingResponse;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || 'Failed to load bookings');
  }

  return Array.isArray(payload.bookings) ? payload.bookings : [];
}
