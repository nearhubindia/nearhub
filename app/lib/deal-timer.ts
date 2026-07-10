import {
  IST_TIME_ZONE,
  addIstCycleMs,
  formatIstDateKey,
  isSameIstDay,
  isTomorrowIstDay,
} from '@/lib/ist-time';

export type DealTimingInput = {
  dealStartAt?: string | null;
  dealEndAt?: string | null;
  dealRecurrence?: string | null;
  dealRecurrenceUntil?: string | null;
};

export type DealCompletionInput = DealTimingInput & {
  isDeal?: boolean | null;
  is_deal?: boolean | null;
  dealStatus?: string | null;
  deal_status?: string | null;
  status?: string | null;
  dealCycleQuantity?: number | string | null;
  deal_cycle_quantity?: number | string | null;
  maxDealBookings?: number | string | null;
  max_deal_bookings?: number | string | null;
  dealBookingsUsed?: number | string | null;
  deal_bookings_used?: number | string | null;
};

export const DEAL_SECTION_WINDOW_DAYS = 5;
const DEAL_SECTION_WINDOW_MS = DEAL_SECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type CountdownPart = {
  label: 'D' | 'H' | 'M';
  value: string;
};

function isValidTimestamp(value: number): value is number {
  return Number.isFinite(value) && value > 0;
}

function parseRawDateTime(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const timestamp = new Date(raw).getTime();
  return isValidTimestamp(timestamp) ? timestamp : undefined;
}

function formatDisplayDate(ms: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms));
}

export function getEffectiveDealWindow(
  input: DealTimingInput,
  nowMs: number
): { startMs: number; endMs: number; cycleKey: string; isRecurring: boolean } | null {
  const firstStartMs = parseRawDateTime(input.dealStartAt ?? null);
  const firstEndMs = parseRawDateTime(input.dealEndAt ?? null);
  if (!firstStartMs || !firstEndMs || firstEndMs <= firstStartMs) return null;

  const recurrence = String(input.dealRecurrence || 'none').toLowerCase();
  const isRecurring = recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly';
  if (!isRecurring) {
    return {
      startMs: firstStartMs,
      endMs: firstEndMs,
      cycleKey: formatIstDateKey(firstStartMs),
      isRecurring: false,
    };
  }

  const repeatUntilMs = parseRawDateTime(input.dealRecurrenceUntil ?? null);
  if (!repeatUntilMs || repeatUntilMs < firstStartMs) return null;

  let startMs = firstStartMs;
  let endMs = firstEndMs;
  let guard = 0;
  while (endMs < nowMs && endMs < repeatUntilMs && guard < 370) {
    startMs = addIstCycleMs(startMs, recurrence);
    endMs = addIstCycleMs(endMs, recurrence);
    guard += 1;
  }

  if (startMs > repeatUntilMs) return null;
  return {
    startMs,
    endMs: Math.min(endMs, repeatUntilMs),
    cycleKey: formatIstDateKey(startMs),
    isRecurring: true,
  };
}

export function formatDealStartMessage(startMs: number, nowMs: number): string {
  if (isSameIstDay(startMs, nowMs)) return 'Deal starts today';
  if (isTomorrowIstDay(startMs, nowMs)) return 'Deal starts tomorrow';
  return `Deal starts on ${formatDisplayDate(startMs)}`;
}

export function formatDealCountdown(milliseconds: number): string {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.max(1, Math.ceil(minutes / 60));
  return `${hours} hr${hours === 1 ? '' : 's'}`;
}

export function formatDealStatus(input: DealTimingInput, nowMs: number): string {
  const window = getEffectiveDealWindow(input, nowMs);
  if (!window) return '';
  const { startMs, endMs, isRecurring } = window;

  if (nowMs < startMs) {
    return isRecurring
      ? `Next deal ${formatDealStartMessage(startMs, nowMs).replace('Deal ', '')}`
      : formatDealStartMessage(startMs, nowMs);
  }

  if (nowMs > endMs) return 'Deal expired';
  return `Ends in ${formatDealCountdown(endMs - nowMs)}`;
}

export function isDealActiveNow(input: DealTimingInput, nowMs: number): boolean {
  const window = getEffectiveDealWindow(input, nowMs);
  if (!window) return false;
  return nowMs >= window.startMs && nowMs <= window.endMs;
}

export function isDealUpcoming(input: DealTimingInput, nowMs: number): boolean {
  const window = getEffectiveDealWindow(input, nowMs);
  if (!window) return false;
  return nowMs < window.startMs;
}

export function isDealExpired(input: DealTimingInput, nowMs: number): boolean {
  const startMs = parseRawDateTime(input.dealStartAt ?? null);
  const endMs = parseRawDateTime(input.dealEndAt ?? null);
  if (!startMs || !endMs) return false;
  return nowMs > endMs;
}

export function isDealUpcomingWithinWindow(input: DealTimingInput, nowMs: number): boolean {
  const window = getEffectiveDealWindow(input, nowMs);
  if (!window) return false;

  let upcomingStartMs = window.startMs;
  if (nowMs >= upcomingStartMs) {
    if (!window.isRecurring) return false;

    const recurrence = String(input.dealRecurrence || 'none').toLowerCase();
    const repeatUntilMs = parseRawDateTime(input.dealRecurrenceUntil ?? null);
    if (!repeatUntilMs) return false;

    let guard = 0;
    while (upcomingStartMs <= nowMs && guard < 370) {
      upcomingStartMs = addIstCycleMs(upcomingStartMs, recurrence);
      guard += 1;
    }
    if (upcomingStartMs <= nowMs || upcomingStartMs > repeatUntilMs) return false;
  }

  return upcomingStartMs - nowMs <= DEAL_SECTION_WINDOW_MS;
}

export function isDealExpiredWithinWindow(input: DealTimingInput, nowMs: number): boolean {
  const window = getEffectiveDealWindow(input, nowMs);
  if (!window || nowMs <= window.endMs) return false;
  return nowMs - window.endMs <= DEAL_SECTION_WINDOW_MS;
}

function parseCompletionNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDealStockCompleted(input: DealCompletionInput): boolean {
  const maxSlots =
    parseCompletionNumber(input.dealCycleQuantity ?? input.deal_cycle_quantity) ||
    parseCompletionNumber(input.maxDealBookings ?? input.max_deal_bookings);
  const usedSlots = parseCompletionNumber(input.dealBookingsUsed ?? input.deal_bookings_used);
  return maxSlots > 0 && usedSlots >= maxSlots;
}

function isDealMarkedCompleted(input: DealCompletionInput): boolean {
  const status = String(input.dealStatus ?? input.deal_status ?? input.status ?? '').toLowerCase();
  return [
    'completed',
    'complete',
    'closed',
    'expired',
    'sold_out',
    'sold-out',
    'stock_completed',
  ].includes(status);
}

export function isDealCompleted(input: DealCompletionInput, nowMs: number): boolean {
  const isExpired = isDealExpiredWithinWindow(input, nowMs);
  return isExpired || isDealStockCompleted(input) || isDealMarkedCompleted(input);
}

export function isDealAvailableForDealSections(input: DealCompletionInput, nowMs: number): boolean {
  return Boolean(input.isDeal ?? input.is_deal) && !isDealCompleted(input, nowMs);
}

export function countdownPartsFromMs(endAt: number | undefined, nowMs: number): CountdownPart[] {
  if (!endAt || endAt <= nowMs) {
    return [
      { label: 'D', value: '00' },
      { label: 'H', value: '00' },
      { label: 'M', value: '00' },
    ];
  }

  const diffMs = Math.max(0, endAt - nowMs);
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return [
    { label: 'D', value: String(days).padStart(2, '0') },
    { label: 'H', value: String(hours).padStart(2, '0') },
    { label: 'M', value: String(minutes).padStart(2, '0') },
  ];
}

export function formatCountdown(endAt: number | undefined, nowMs: number): string {
  return countdownPartsFromMs(endAt, nowMs)
    .map((part) => part.value)
    .join(' : ');
}
