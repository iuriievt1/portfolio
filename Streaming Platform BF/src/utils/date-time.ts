/** One minute, in the milliseconds every timestamp here is measured in. */
export const MINUTE_MS = 60_000;

/** One hour, in milliseconds. */
export const HOUR_MS = 60 * MINUTE_MS;

const clockFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

/** Returns the operating system's current IANA time zone. */
export function getDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getResolvedTimeZone(timeZone?: string) {
  return timeZone ?? getDeviceTimeZone();
}

/** Parses an ISO date string to epoch milliseconds, or null when it is missing or invalid. */
export function parseDateMs(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Local midnight of the day a moment falls on. */
export function startOfDay(timeMs: number) {
  const date = new Date(timeMs);
  date.setHours(0, 0, 0, 0);

  return date.getTime();
}

/** Whether two moments fall on the same local day. */
export function isSameDay(firstMs: number, secondMs: number) {
  return startOfDay(firstMs) === startOfDay(secondMs);
}

/** Whether two moments fall on the same calendar day in a requested zone. */
export function isSameDayInTimeZone(
  firstMs: number,
  secondMs: number,
  timeZone?: string,
) {
  const resolvedTimeZone = getResolvedTimeZone(timeZone);
  let formatter = dayKeyFormatters.get(resolvedTimeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: resolvedTimeZone,
      year: "numeric",
    });
    dayKeyFormatters.set(resolvedTimeZone, formatter);
  }

  return formatter.format(firstMs) === formatter.format(secondMs);
}

/** Formats a moment as `HH:mm`, with seconds when asked. */
export function formatClockTime({
  timeMs,
  timeZone,
  withSeconds = false,
}: {
  timeMs: number;
  timeZone?: string | undefined;
  withSeconds?: boolean;
}) {
  const resolvedTimeZone = getResolvedTimeZone(timeZone);
  const key = `${resolvedTimeZone}|${withSeconds}`;
  let formatter = clockFormatters.get(key);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      timeZone: resolvedTimeZone,
      ...(withSeconds ? { second: "2-digit" } : {}),
    });
    clockFormatters.set(key, formatter);
  }

  return formatter.format(new Date(timeMs));
}

/** Formats a moment as `9 October 2025`, or `9 October` without the year, in the requested zone. */
export function formatDate({
  timeMs,
  timeZone,
  withYear = true,
}: {
  timeMs: number;
  timeZone?: string | undefined;
  withYear?: boolean;
}) {
  const resolvedTimeZone = getResolvedTimeZone(timeZone);
  const key = `${resolvedTimeZone}|${withYear}`;
  let formatter = dateFormatters.get(key);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      timeZone: resolvedTimeZone,
      ...(withYear ? { year: "numeric" } : {}),
    });
    dateFormatters.set(key, formatter);
  }

  return formatter.format(new Date(timeMs));
}

/** Formats a moment as `16 October at 15:00` in the requested zone. */
export function formatDateAtTime({
  timeMs,
  timeZone,
}: {
  timeMs: number;
  timeZone?: string | undefined;
}) {
  const date = formatDate({ timeMs, timeZone, withYear: false });
  const time = formatClockTime({ timeMs, timeZone });

  return `${date} at ${time}`;
}
