import { formatRelativeStart } from "@/features/live-channels/format-relative-start";

/**
 * `formatRelativeStart` formats in the device's local timezone, so these
 * fixtures are built from local-time components rather than fixed UTC strings.
 * That keeps the expected labels correct on any host machine.
 */
function localStart(day: number, hours: number, minutes: number) {
  return new Date(2026, 6, day, hours, minutes).toISOString();
}

/** Local 20 July 2026, 14:30. */
const NOW = new Date(2026, 6, 20, 14, 30).getTime();

describe("formatRelativeStart", () => {
  test("labels a start time earlier today", () => {
    expect(formatRelativeStart(localStart(20, 14, 0), NOW)).toBe("Today 14:00");
  });

  test("labels a start time later today", () => {
    expect(formatRelativeStart(localStart(20, 19, 0), NOW)).toBe("Today 19:00");
  });

  test("returns undefined when the start time is missing", () => {
    expect(formatRelativeStart(undefined, NOW)).toBeUndefined();
  });

  test("returns undefined when the start time is unparseable", () => {
    expect(formatRelativeStart("not-a-date", NOW)).toBeUndefined();
  });

  test("returns the clock time when programme started on a previous day", () => {
    expect(formatRelativeStart(localStart(19, 23, 30), NOW)).toBe("23:30");
  });

  test("formats both the day and clock in the selected time zone", () => {
    const nowMs = Date.parse("2026-07-20T23:30:00.000Z");

    expect(
      formatRelativeStart("2026-07-20T23:00:00.000Z", nowMs, "Europe/London"),
    ).toBe("Today 00:00");
    expect(formatRelativeStart("2026-07-20T23:00:00.000Z", nowMs, "UTC")).toBe(
      "Today 23:00",
    );
  });
});
