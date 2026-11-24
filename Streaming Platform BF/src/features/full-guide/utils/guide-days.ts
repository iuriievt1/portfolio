import type { GuideDay } from "@/features/full-guide/types";
import { covers } from "@/features/full-guide/utils/guide-cells";
import { HOUR_MS, startOfDay } from "@/utils/date-time";
import { clamp } from "@/utils/number";

/** The guide covers a week from today. */
export const GUIDE_DAY_COUNT = 7;

const MAX_WINDOW_HOURS = 24;
const MIN_WINDOW_HOURS = 1;

function toDayKey(timeMs: number) {
  const date = new Date(timeMs);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/** The days the guide covers, starting with the day of the given moment. */
export function getGuideDays(nowMs: number): GuideDay[] {
  const cursor = new Date(startOfDay(nowMs));
  const days: GuideDay[] = [];

  for (let index = 0; index < GUIDE_DAY_COUNT; index += 1) {
    const startMs = cursor.getTime();
    cursor.setDate(cursor.getDate() + 1);

    days.push({ endMs: cursor.getTime(), key: toDayKey(startMs), startMs });
  }

  return days;
}

/** The API takes 1-24 hours, and clock changes make days uneven. */
export function getWindowDurationHours({ endMs, startMs }: GuideDay) {
  const hours = Math.round((endMs - startMs) / HOUR_MS);

  return clamp({ max: MAX_WINDOW_HOURS, min: MIN_WINDOW_HOURS, value: hours });
}

/** The stretch of a day one request can fetch; a 25-hour day loses its last hour. */
export function getFetchedRange(day: GuideDay): GuideDay {
  return {
    ...day,
    endMs: Math.min(
      day.endMs,
      day.startMs + getWindowDurationHours(day) * HOUR_MS,
    ),
  };
}

/** The day a moment belongs to, or -1 when it falls outside the week. */
export function getDayIndexAt(days: GuideDay[], timeMs: number) {
  return days.findIndex((day) => covers(day, timeMs));
}

/** The same wall-clock time, read on another day of the week. */
export function getTimeOnDay({
  day,
  timeMs,
}: {
  day: GuideDay;
  timeMs: number;
}) {
  const time = new Date(timeMs);
  const onDay = new Date(day.startMs);

  onDay.setHours(
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds(),
  );

  return onDay.getTime();
}
