import { getApiUrl } from '@/lib/config';

export type StoredUser = { id?: string; phone?: string; name?: string };

export type DealVoucherPayload = {
  listingTitle?: string;
  bookedAt?: string;
  dealStartAt?: string | null;
  dealEndAt?: string | null;
  comboItems?: string[];
  terms?: string;
};

export type DealBooking = {
  id: string;
  listingId: string;
  sellerId: string;
  status: string;
  voucherCode: string;
  voucherPayload?: string | DealVoucherPayload | null;
  bookedAt?: string;
  redeemedAt?: string | null;
  createdAt?: string;
};

export type DealStatTone = 'blue' | 'emerald' | 'amber' | 'rose';

export function readStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('nearhub_web_user');
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function parseVoucherPayload(value: DealBooking['voucherPayload']): DealVoucherPayload {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as DealVoucherPayload) : {};
  } catch {
    return {};
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'redeemed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'cancelled' || normalized === 'expired') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export function statusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'redeemed') return 'encashed';
  if (normalized === 'booked') return 'purchased';
  return status || 'purchased';
}

export function statIconClass(tone: DealStatTone): string {
  const classes = {
    blue: 'bg-blue-50 text-[#0759e6]',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-orange-50 text-orange-500',
    rose: 'bg-rose-50 text-rose-500',
  };
  return classes[tone];
}

export function apiUrl(path: string): string {
  return `${getApiUrl().replace(/\/$/, '')}${path}`;
}

export async function openVoucherPdf(params: {
  bookingId: string;
  authHeaders: HeadersInit;
  setVoucherLoadingId: (bookingId: string) => void;
  setMessage: (message: string) => void;
}): Promise<void> {
  const { bookingId, authHeaders, setVoucherLoadingId, setMessage } = params;
  setVoucherLoadingId(bookingId);
  setMessage('');

  try {
    const response = await fetch(
      apiUrl(`/api/deals/bookings/${encodeURIComponent(bookingId)}/voucher`),
      { headers: authHeaders }
    );
    if (!response.ok) throw new Error('Failed to load PDF voucher');

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Failed to open PDF voucher');
  } finally {
    setVoucherLoadingId('');
  }
}
