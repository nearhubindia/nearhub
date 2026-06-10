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

function isValidTimestamp(value: number): value is number {
  return Number.isFinite(value) && value > 0;
}

function parseIsoDateTime(date?: string | null, time?: string | null): number | undefined {
  if (!date || !time) return undefined;
  const timestamp = new Date(`${date}T${time}`).getTime();
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

function addCycle(date: Date, recurrence: string): Date {
  const next = new Date(date);
  if (recurrence === 'daily') next.setDate(next.getDate() + 1);
  if (recurrence === 'weekly') next.setDate(next.getDate() + 7);
  if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
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
      cycleKey: new Date(firstStartMs).toISOString().slice(0, 10),
      isRecurring: false,
    };
  }

  const repeatUntilMs = parseRawDateTime(
    input.dealRecurrenceUntil ?? input.deal_recurrence_until ?? null
  );
  if (!repeatUntilMs || repeatUntilMs < firstStartMs) return null;

  let start = new Date(firstStartMs);
  let end = new Date(firstEndMs);
  let guard = 0;
  while (end.getTime() < nowMs && end.getTime() < repeatUntilMs && guard < 370) {
    start = addCycle(start, recurrence);
    end = addCycle(end, recurrence);
    guard += 1;
  }

  if (start.getTime() > repeatUntilMs) return null;
  return {
    startMs: start.getTime(),
    endMs: Math.min(end.getTime(), repeatUntilMs),
    cycleKey: start.toISOString().slice(0, 10),
    isRecurring: true,
  };
}

function getDateOnly(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isSameDay(msA: number, msB: number): boolean {
  return getDateOnly(msA) === getDateOnly(msB);
}

function isTomorrow(startMs: number, nowMs: number): boolean {
  const tomorrow = new Date(nowMs);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getDateOnly(startMs) === tomorrow.getTime();
}

function formatDisplayDate(ms: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms));
}

export function formatDealStartMessage(startMs: number, nowMs: number): string {
  if (isSameDay(startMs, nowMs)) {
    return 'Deal starts today';
  }
  if (isTomorrow(startMs, nowMs)) {
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
