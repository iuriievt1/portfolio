import { getDeviceTimeZone, isSameDayInTimeZone } from "@/utils/date-time";

const formatters = new Map<
  string,
  { dayMonth: Intl.DateTimeFormat; weekday: Intl.DateTimeFormat }
>();

function getFormatters(timeZone: string) {
  let formatter = formatters.get(timeZone);

  if (!formatter) {
    formatter = {
      dayMonth: new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone,
      }),
      weekday: new Intl.DateTimeFormat("en-GB", {
        timeZone,
        weekday: "short",
      }),
    };
    formatters.set(timeZone, formatter);
  }

  return formatter;
}

/** Today keeps its name, the rest of the week gets its weekday. */
export function formatDayLabel({
  dayStartMs,
  nowMs,
  timeZone = getDeviceTimeZone(),
}: {
  dayStartMs: number;
  nowMs: number;
  timeZone?: string;
}) {
  const { dayMonth, weekday } = getFormatters(timeZone);
  const dayMonthLabel = dayMonth.format(new Date(dayStartMs));

  return isSameDayInTimeZone(dayStartMs, nowMs, timeZone)
    ? `Today ${dayMonthLabel}`
    : `${weekday.format(new Date(dayStartMs))} ${dayMonthLabel}`;
}
