export const IST_TIME_ZONE = 'Asia/Kolkata';

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

type IstParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function isValidTimestamp(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function getIstShiftedDate(ms: number): Date {
  return new Date(ms + IST_OFFSET_MS);
}

function getIstParts(ms: number): IstParts {
  const shifted = getIstShiftedDate(ms);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function parseTimestamp(value: Date | string | null | undefined): number | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return isValidTimestamp(timestamp) ? timestamp : undefined;
}

export function isSameIstDay(msA: number, msB: number): boolean {
  const a = getIstParts(msA);
  const b = getIstParts(msB);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function isTomorrowIstDay(startMs: number, nowMs: number): boolean {
  const today = getIstShiftedDate(nowMs);
  today.setUTCHours(0, 0, 0, 0);
  today.setUTCDate(today.getUTCDate() + 1);
  const tomorrowMs = today.getTime() - IST_OFFSET_MS;
  return isSameIstDay(startMs, tomorrowMs);
}

export function addIstCycleMs(ms: number, recurrence: string): number {
  const shifted = getIstShiftedDate(ms);
  if (recurrence === 'daily') shifted.setUTCDate(shifted.getUTCDate() + 1);
  if (recurrence === 'weekly') shifted.setUTCDate(shifted.getUTCDate() + 7);
  if (recurrence === 'monthly') shifted.setUTCMonth(shifted.getUTCMonth() + 1);
  return shifted.getTime() - IST_OFFSET_MS;
}

export function toIstCycleKey(ms: number): string {
  const parts = getIstParts(ms);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}
