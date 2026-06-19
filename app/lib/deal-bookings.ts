import { getBackendURL } from '@/lib/config';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';
import { Linking, Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

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

type VoucherDownloadResult = {
  uri: string;
  openedUri?: string;
};

export function parseVoucherPayload(value: DealBooking['voucherPayload']): DealVoucherPayload {
  if (!value) return {};
  if (typeof value === 'object') return value as DealVoucherPayload;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as DealVoucherPayload) : {};
  } catch {
    return {};
  }
}

export function statusLabel(status?: string | null): string {
  const normalized = String(status || 'booked').toLowerCase();
  if (normalized === 'redeemed') return 'Encashed';
  if (normalized === 'booked') return 'Purchased';
  if (!normalized) return 'Purchased';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function voucherEndpoint(bookingId: string, mode: 'view' | 'download'): string {
  const suffix = mode === 'download' ? '/download' : '';
  return `${getBackendURL()}/api/deals/bookings/${encodeURIComponent(bookingId)}/voucher${suffix}`;
}

function voucherFileUri(bookingId: string): string {
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!baseDir) {
    throw new Error('No writable local directory available');
  }
  return `${baseDir}nearhub-voucher-${bookingId}.pdf`;
}

async function fetchVoucherBlobUrl(
  bookingId: string,
  user: VoucherAccessIdentity,
  mode: 'view' | 'download'
): Promise<string> {
  const response = await fetch(voucherEndpoint(bookingId, mode), {
    method: 'GET',
    headers: buildUserAuthHeaders(user, { includeContentType: false }),
  });
  if (!response.ok) {
    throw new Error(
      mode === 'download' ? 'Failed to download PDF voucher' : 'Failed to open PDF voucher'
    );
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function saveVoucherPdf(
  bookingId: string,
  user: VoucherAccessIdentity,
  mode: 'view' | 'download'
): Promise<VoucherDownloadResult> {
  if (Platform.OS === 'web') {
    return { uri: await fetchVoucherBlobUrl(bookingId, user, mode) };
  }

  const targetUri = voucherFileUri(bookingId);
  const result = await FileSystem.downloadAsync(voucherEndpoint(bookingId, mode), targetUri, {
    headers: buildUserAuthHeaders(user, { includeContentType: false }),
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      mode === 'download' ? 'Failed to download PDF voucher' : 'Failed to open PDF voucher'
    );
  }

  const openedUri = await FileSystem.getContentUriAsync(result.uri).catch(() => result.uri);
  return { uri: result.uri, openedUri };
}

async function shareVoucherFile(result: VoucherDownloadResult, title: string): Promise<void> {
  // Share the real file URI so Android can hand it off to PDF viewers or save targets.
  const url = result.uri;
  const response = await Share.share(
    { url, title },
    Platform.OS === 'android'
      ? {
          dialogTitle: title,
        }
      : undefined
  );

  if (response.action === Share.dismissedAction) {
    return;
  }
}

export async function openDealVoucherPdf(
  bookingId: string,
  user: VoucherAccessIdentity
): Promise<void> {
  if (Platform.OS === 'web') {
    const objectUrl = await fetchVoucherBlobUrl(bookingId, user, 'view');
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  const saved = await saveVoucherPdf(bookingId, user, 'view');
  try {
    await Linking.openURL(saved.openedUri || saved.uri);
  } catch {
    await shareVoucherFile(saved, 'Open deal voucher');
  }
}

export async function downloadDealVoucherPdf(
  bookingId: string,
  user: VoucherAccessIdentity
): Promise<VoucherDownloadResult> {
  if (Platform.OS === 'web') {
    const objectUrl = await fetchVoucherBlobUrl(bookingId, user, 'download');
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `nearhub-voucher-${bookingId}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return { uri: objectUrl };
  }

  const saved = await saveVoucherPdf(bookingId, user, 'download');
  await shareVoucherFile(saved, 'Download deal voucher');
  return saved;
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

  return Array.isArray(payload.bookings) ? payload.bookings : [];
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

  return Array.isArray(payload.bookings) ? payload.bookings : [];
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

  return payload.booking;
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

  return payload.booking;
}
