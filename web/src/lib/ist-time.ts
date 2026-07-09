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

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatIstDateInputValue(date: Date): string {
  const parts = getIstParts(date.getTime());
  return `${parts.year}-${padTwo(parts.month)}-${padTwo(parts.day)}`;
}

export function formatIstTimeInputValue(date: Date): string {
  const parts = getIstParts(date.getTime());
  return `${padTwo(parts.hour)}:${padTwo(parts.minute)}`;
}

export function parseIstDateTimeToDate(dateValue: string, timeValue: string): Date | null {
  const dateMatch = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeValue.trim().match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - IST_OFFSET_MS;
  const parts = getIstParts(utcMs);
  if (
    parts.year !== year ||
    parts.month !== month ||
    parts.day !== day ||
    parts.hour !== hour ||
    parts.minute !== minute
  ) {
    return null;
  }

  return new Date(utcMs);
}

export function formatIstDateTime(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }

  return date.toLocaleString('en-IN', {
    timeZone: IST_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  });
}

export function addIstCycleMs(ms: number, recurrence: string): number {
  const shifted = getIstShiftedDate(ms);
  if (recurrence === 'daily') shifted.setUTCDate(shifted.getUTCDate() + 1);
  if (recurrence === 'weekly') shifted.setUTCDate(shifted.getUTCDate() + 7);
  if (recurrence === 'monthly') shifted.setUTCMonth(shifted.getUTCMonth() + 1);
  return shifted.getTime() - IST_OFFSET_MS;
}

export function formatIstDateKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return formatIstDateInputValue(date);
}

export function isSameIstDay(msA: number, msB: number): boolean {
  return formatIstDateKey(msA) === formatIstDateKey(msB);
}

export function isTomorrowIstDay(startMs: number, nowMs: number): boolean {
  const tomorrow = parseIstDateTimeToDate(formatIstDateInputValue(new Date(nowMs)), '00:00');
  if (!tomorrow) return false;
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return isSameIstDay(startMs, tomorrow.getTime());
}
