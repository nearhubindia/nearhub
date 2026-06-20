import { getBackendURL } from '@/lib/config';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';
import { Linking, Platform } from 'react-native';
import { normalizeDealBookingRecord, normalizeDealVoucherPayload } from '@/lib/deal-normalizers';

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

export type DealVoucherPayload = {
  listingTitle?: string;
  listingImage?: string;
  listingImages?: string[];
  bookedAt?: string;
  dealStartAt?: string | null;
  dealEndAt?: string | null;
  comboItems?: string[];
  terms?: string;
  category?: string;
  location?: string;
  price?: number;
  offerPrice?: number;
};

type VoucherAccessIdentity = {
  id: string;
  phone?: string | null;
  token?: string | null;
};

type BookingResponse = {
  success?: boolean;
  booking?: DealBooking;
  bookings?: DealBooking[];
  voucherViewUrl?: string;
  error?: string;
  message?: string;
  code?: string;
};

export class DealBookingError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = 'DealBookingError';
    this.status = options?.status;
    this.code = options?.code;
  }
}

type VoucherOpenResult = {
  uri: string;
};

export function parseVoucherPayload(value: DealBooking['voucherPayload']): DealVoucherPayload {
  return normalizeDealVoucherPayload(value);
}

export function statusLabel(status?: string | null): string {
  const normalized = String(status || 'booked').toLowerCase();
  if (normalized === 'redeemed') return 'Encashed';
  if (normalized === 'booked') return 'Purchased';
  if (!normalized) return 'Purchased';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function voucherEndpoint(
  bookingId: string,
  mode: 'view' | 'download',
  userId: string,
  token?: string | null
): string {
  const suffix = mode === 'download' ? '/download' : '';
  const baseUrl = `${getBackendURL()}/api/deals/bookings/${encodeURIComponent(bookingId)}/voucher${suffix}`;
  const url = new URL(baseUrl);
  url.searchParams.set('userId', userId);
  if (typeof token === 'string' && token.trim()) {
    url.searchParams.set('token', token.trim());
  }
  return url.toString();
}

function buildVoucherUrl(
  bookingId: string,
  user: VoucherAccessIdentity,
  mode: 'view' | 'download'
): string {
  return voucherEndpoint(bookingId, mode, user.id, user.token);
}

async function openVoucherUrl(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  await Linking.openURL(url);
}

export async function openDealVoucherPdf(
  bookingId: string,
  user: VoucherAccessIdentity
): Promise<void> {
  await openVoucherUrl(buildVoucherUrl(bookingId, user, 'view'));
}

export async function downloadDealVoucherPdf(
  bookingId: string,
  user: VoucherAccessIdentity
): Promise<VoucherOpenResult> {
  const uri = buildVoucherUrl(bookingId, user, 'download');
  await openVoucherUrl(uri);
  return { uri };
}

export async function bookDeal(listingId: string, userId: string, userPhone?: string) {
  const backendURL = getBackendURL();
  const response = await fetch(`${backendURL}/api/deals/${encodeURIComponent(listingId)}/book`, {
    method: 'POST',
    headers: buildUserAuthHeaders({ id: userId, phone: userPhone }),
  });

  const payload = (await response.json().catch(() => ({}))) as BookingResponse;
  if (!response.ok || payload.success === false) {
    const message = payload.error || payload.message || 'Failed to book deal';
    const code =
      payload.code ||
      (response.status === 409 || /already booked|already purchased/i.test(message)
        ? 'ALREADY_BOOKED'
        : undefined);
    throw new DealBookingError(message, { status: response.status, code });
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

  return Array.isArray(payload.bookings)
    ? payload.bookings.map((booking) => normalizeDealBookingRecord(booking))
    : [];
}

export async function fetchSellerDealBookings(userId: string, userPhone?: string) {
  const backendURL = getBackendURL();
  const response = await fetch(`${backendURL}/api/deals/seller/bookings`, {
    method: 'GET',
    headers: buildUserAuthHeaders({ id: userId, phone: userPhone }),
  });

  const payload = (await response.json().catch(() => ({}))) as BookingResponse;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || 'Failed to load seller bookings');
  }

  return Array.isArray(payload.bookings)
    ? payload.bookings.map((booking) => normalizeDealBookingRecord(booking))
    : [];
}

export async function updateDealBookingStatus(params: {
  bookingId: string;
  status: 'encashed' | 'redeemed' | 'cancelled' | 'expired' | 'booked';
  userId: string;
  userPhone?: string;
}) {
  const { bookingId, status, userId, userPhone } = params;
  const backendURL = getBackendURL();
  const response = await fetch(
    `${backendURL}/api/deals/bookings/${encodeURIComponent(bookingId)}/status`,
    {
      method: 'POST',
      headers: buildUserAuthHeaders({ id: userId, phone: userPhone }),
      body: JSON.stringify({ status }),
    }
  );

  const payload = (await response.json().catch(() => ({}))) as BookingResponse;
  if (!response.ok || payload.success === false || !payload.booking) {
    throw new Error(payload.error || payload.message || 'Failed to update booking status');
  }

  return normalizeDealBookingRecord(payload.booking);
}

export async function cancelDealBooking(params: {
  bookingId: string;
  userId: string;
  userPhone?: string;
}) {
  const { bookingId, userId, userPhone } = params;
  const backendURL = getBackendURL();
  const response = await fetch(
    `${backendURL}/api/deals/bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      method: 'POST',
      headers: buildUserAuthHeaders({ id: userId, phone: userPhone }),
    }
  );

  const payload = (await response.json().catch(() => ({}))) as BookingResponse;
  if (!response.ok || payload.success === false || !payload.booking) {
    throw new DealBookingError(payload.error || payload.message || 'Failed to cancel booking', {
      status: response.status,
      code: payload.code,
    });
  }

  return normalizeDealBookingRecord(payload.booking);
}
