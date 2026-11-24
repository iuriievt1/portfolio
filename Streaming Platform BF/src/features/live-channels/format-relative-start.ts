import {
  formatClockTime,
  getDeviceTimeZone,
  isSameDayInTimeZone,
  parseDateMs,
} from "@/utils/date-time";

/**
 * Labels a programme start time relative to now, e.g. "Today 14:00".
 *
 * Only today is handled here; live tiles are always on air. Future day
 * labels belong with the upcoming-programmes work.
 */
export function formatRelativeStart(
  startDateTime: string | undefined,
  nowMs: number,
  timeZone = getDeviceTimeZone(),
) {
  const startMs = parseDateMs(startDateTime);

  if (startMs === null) {
    return undefined;
  }

  const clockTime = formatClockTime({ timeMs: startMs, timeZone });

  return isSameDayInTimeZone(startMs, nowMs, timeZone)
    ? `Today ${clockTime}`
    : clockTime;
}
