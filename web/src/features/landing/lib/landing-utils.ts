export const SAVED_LISTING_IDS_KEY = 'nearhub_web_saved_listing_ids';

export function readStoredStringSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []
    );
  } catch {
    return new Set();
  }
}

export function writeStoredStringSet(key: string, values: Iterable<string>): void {
  localStorage.setItem(key, JSON.stringify([...values]));
}

export function parsePositiveNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function formatCurrencyInr(value: number | undefined): string {
  if (!value) return 'Price on request';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPriceInr(value: number | string | undefined): string {
  return formatCurrencyInr(parsePositiveNumber(value));
}

export function formatDistanceKm(value: number | string | undefined): string {
  const distance = typeof value === 'string' ? Number(value) : value;
  if (Number.isFinite(distance) && Number(distance) >= 0) {
    const rounded =
      Number(distance) < 1
        ? Number(distance).toFixed(2)
        : Number(distance) < 10
          ? Number(distance).toFixed(1)
          : Math.round(Number(distance)).toString();
    return `${rounded.replace(/\.0$/, '')} km away`;
  }
  return 'Nearby';
}

export function countdownPartsFromMs(
  endAt: number | undefined,
  nowMs: number
): Array<{ value: string; label: string }> {
  const diff = typeof endAt === 'number' && Number.isFinite(endAt) ? Math.max(0, endAt - nowMs) : 0;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    { value: pad(days), label: 'DAYS' },
    { value: pad(hours), label: 'HOURS' },
    { value: pad(minutes), label: 'MINS' },
    { value: pad(seconds), label: 'SECS' },
  ];
}

export function discountPercentage(
  price: number | undefined,
  originalPrice: number | undefined
): string | null {
  if (!price || !originalPrice || originalPrice <= price) return null;
  return `${Math.round(((originalPrice - price) / originalPrice) * 100)}% OFF`;
}
