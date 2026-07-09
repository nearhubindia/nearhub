import { addIstCycleMs, parseTimestamp } from './ist-time';

type DealWindowInput = {
  dealStartAt?: Date | string | null;
  dealEndAt?: Date | string | null;
  dealRecurrence?: string | null;
  dealRecurrenceUntil?: Date | string | null;
};

export type DealLifecycleStatus = 'upcoming' | 'active' | 'expired';

export function getEffectiveDealWindow(
  input: DealWindowInput,
  nowMs: number
): { startMs: number; endMs: number; isRecurring: boolean } | null {
  const firstStartMs = parseTimestamp(input.dealStartAt);
  const firstEndMs = parseTimestamp(input.dealEndAt);
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

  const repeatUntilMs = parseTimestamp(input.dealRecurrenceUntil);
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
