type DealWindowInput = {
  dealStartAt?: Date | string | null;
  dealEndAt?: Date | string | null;
  dealRecurrence?: string | null;
  dealRecurrenceUntil?: Date | string | null;
};

export type DealLifecycleStatus = 'upcoming' | 'active' | 'expired';

function toTimestamp(value: Date | string | null | undefined): number | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function addCycle(date: Date, recurrence: string): Date {
  const next = new Date(date);
  if (recurrence === 'daily') next.setDate(next.getDate() + 1);
  if (recurrence === 'weekly') next.setDate(next.getDate() + 7);
  if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
}

export function getEffectiveDealWindow(
  input: DealWindowInput,
  nowMs: number
): { startMs: number; endMs: number; isRecurring: boolean } | null {
  const firstStartMs = toTimestamp(input.dealStartAt);
  const firstEndMs = toTimestamp(input.dealEndAt);
  if (!firstStartMs || !firstEndMs || firstEndMs <= firstStartMs) return null;

  const recurrence = String(input.dealRecurrence || 'none').toLowerCase();
  const isRecurring = recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly';
  if (!isRecurring) {
    return {
      startMs: firstStartMs,
      endMs: firstEndMs,
      isRecurring: false,
    };
  }

  const repeatUntilMs = toTimestamp(input.dealRecurrenceUntil);
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
    isRecurring: true,
  };
}

export function deriveDealStatus(
  input: DealWindowInput & {
    isDeal?: boolean | null | undefined;
    is_deal?: boolean | null | undefined;
  },
  nowMs = Date.now()
): DealLifecycleStatus | null {
  if (!(input.isDeal ?? input.is_deal)) return null;
  const window = getEffectiveDealWindow(input, nowMs);
  if (!window) return null;
  if (nowMs < window.startMs) return 'upcoming';
  if (nowMs > window.endMs) return 'expired';
  return 'active';
}
