import {
  formatClockTime,
  formatDate,
  isSameDayInTimeZone,
} from "@/utils/date-time";

describe("time-zone-aware date formatting", () => {
  test("Europe/London observes GMT and British Summer Time", () => {
    expect(
      formatClockTime({
        timeMs: Date.parse("2026-01-15T12:00:00.000Z"),
        timeZone: "Europe/London",
      }),
    ).toBe("12:00");
    expect(
      formatClockTime({
        timeMs: Date.parse("2026-07-15T12:00:00.000Z"),
        timeZone: "Europe/London",
      }),
    ).toBe("13:00");
  });

  test("compares calendar days in the selected zone", () => {
    const firstMs = Date.parse("2026-07-20T23:30:00.000Z");
    const secondMs = Date.parse("2026-07-21T00:30:00.000Z");

    expect(isSameDayInTimeZone(firstMs, secondMs, "Europe/London")).toBe(true);
    expect(isSameDayInTimeZone(firstMs, secondMs, "UTC")).toBe(false);
  });

  test("formats a date in the selected zone", () => {
    const timeMs = Date.parse("2026-09-29T10:47:36Z");

    expect(formatDate({ timeMs, timeZone: "UTC" })).toBe("29 September 2026");
    expect(formatDate({ timeMs, timeZone: "Europe/London" })).toBe(
      "29 September 2026",
    );
  });

  test("drops the year when asked", () => {
    const timeMs = Date.parse("2026-09-29T10:47:36Z");

    expect(formatDate({ timeMs, timeZone: "UTC", withYear: false })).toBe(
      "29 September",
    );
  });

  test("moves the date when the zone crosses midnight", () => {
    const timeMs = Date.parse("2026-07-20T23:30:00Z");

    expect(formatDate({ timeMs, timeZone: "UTC" })).toBe("20 July 2026");
    expect(formatDate({ timeMs, timeZone: "Europe/London" })).toBe(
      "21 July 2026",
    );
  });
});
