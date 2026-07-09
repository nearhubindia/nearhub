import {
  IST_TIME_ZONE,
  addIstCycleMs,
  formatIstDateKey,
  isSameIstDay,
  isTomorrowIstDay,
  parseIstDateTimeToDate,
} from '@/lib/ist-time';

export type DealTimingInput = {
  dealStartAt?: string | null;
  deal_start_at?: string | null;
  dealEndAt?: string | null;
  deal_end_at?: string | null;
  dealRecurrence?: string | null;
  deal_recurrence?: string | null;
  dealRecurrenceUntil?: string | null;
  deal_recurrence_until?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
};

export const DEAL_SECTION_WINDOW_DAYS = 5;
const DEAL_SECTION_WINDOW_MS = DEAL_SECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function isValidTimestamp(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function parseIsoDateTime(date?: string | null, time?: string | null): number | undefined {
  if (!date || !time) return undefined;
  const parsedDate = parseIstDateTimeToDate(date, time);
  const timestamp = parsedDate?.getTime();
  return isValidTimestamp(timestamp) ? timestamp : undefined;
}

function parseRawDateTime(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const timestamp = new Date(raw).getTime();
  return isValidTimestamp(timestamp) ? timestamp : undefined;
}

export function parseDealStartMs(input: DealTimingInput): number | undefined {
  const fromSeparate = parseIsoDateTime(input.startDate, input.startTime);
  if (fromSeparate !== undefined) return fromSeparate;
  return parseRawDateTime(input.dealStartAt ?? input.deal_start_at ?? null);
}

export function parseDealEndMs(input: DealTimingInput): number | undefined {
  const fromSeparate = parseIsoDateTime(input.endDate, input.endTime);
  if (fromSeparate !== undefined) return fromSeparate;
  return parseRawDateTime(input.dealEndAt ?? input.deal_end_at ?? null);
}

export function getEffectiveDealWindow(
  input: DealTimingInput,
  nowMs: number
): { startMs: number; endMs: number; cycleKey: string; isRecurring: boolean } | null {
  const firstStartMs = parseDealStartMs(input);
  const firstEndMs = parseDealEndMs(input);
  if (!firstStartMs || !firstEndMs || firstEndMs <= firstStartMs) return null;

  const recurrence = String(input.dealRecurrence || input.deal_recurrence || 'none').toLowerCase();
  const isRecurring = recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly';
  if (!isRecurring) {
    return {
      startMs: firstStartMs,
      endMs: firstEndMs,
      cycleKey: formatIstDateKey(firstStartMs),
      isRecurring: false,
    };
  }

  const repeatUntilMs = parseRawDateTime(
    input.dealRecurrenceUntil ?? input.deal_recurrence_until ?? null
  );
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

function formatDisplayDate(ms: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms));
}

export function formatDealStartMessage(startMs: number, nowMs: number): string {
  if (isSameIstDay(startMs, nowMs)) {
    return 'Deal starts today';
  }
  if (isTomorrowIstDay(startMs, nowMs)) {
    return 'Deal starts tomorrow';
  }
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
  if (nowMs > endMs) {
    return 'Deal expired';
  }
  return `Ends in ${formatDealCountdown(endMs - nowMs)}`;
}

export function isDealActiveNow(input: DealTimingInput, nowMs: number): boolean {
  const window = getEffectiveDealWindow(input, nowMs);
  if (!window) return false;
  const { startMs, endMs } = window;
  if (startMs && nowMs < startMs) return false;
  return nowMs <= endMs;
}

export function isDealUpcomingWithinWindow(input: DealTimingInput, nowMs: number): boolean {
  const window = getEffectiveDealWindow(input, nowMs);
  if (!window || nowMs >= window.startMs) return false;
  return window.startMs - nowMs <= DEAL_SECTION_WINDOW_MS;
}

export function isDealExpiredWithinWindow(input: DealTimingInput, nowMs: number): boolean {
  const window = getEffectiveDealWindow(input, nowMs);
  if (!window || nowMs <= window.endMs) return false;
  return nowMs - window.endMs <= DEAL_SECTION_WINDOW_MS;
}
