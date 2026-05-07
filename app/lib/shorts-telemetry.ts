import { getDebug } from '@/lib/config';

export type ShortsTelemetryEvent =
  | 'shorts_first_frame'
  | 'shorts_source_fallback'
  | 'shorts_playback_error';

export function trackShortsTelemetry(
  event: ShortsTelemetryEvent,
  payload: Record<string, unknown>
): void {
  if (!getDebug()) return;
  console.log(`[ShortsTelemetry] ${event}`, payload);
}
