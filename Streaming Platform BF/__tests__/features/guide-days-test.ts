import {
  GUIDE_DAY_COUNT,
  getDayIndexAt,
  getFetchedRange,
  getGuideDays,
  getTimeOnDay,
  getWindowDurationHours,
} from "@/features/full-guide";

const MIDDAY = new Date(2026, 4, 30, 12, 30).getTime();

describe("getGuideDays", () => {
  test("covers a week starting with today", () => {
    const days = getGuideDays(MIDDAY);

    expect(days).toHaveLength(GUIDE_DAY_COUNT);
    expect(days[0]?.key).toBe("2026-05-30");
    expect(days.at(-1)?.key).toBe("2026-06-05");
  });

  test("starts each day at local midnight and ends at the next", () => {
    const [today, tomorrow] = getGuideDays(MIDDAY);

    expect(new Date(today?.startMs ?? 0).getHours()).toBe(0);
    expect(today?.endMs).toBe(tomorrow?.startMs);
  });

  test("rolls over month ends", () => {
    const days = getGuideDays(new Date(2026, 11, 29, 9, 0).getTime());

    expect(days.slice(0, 4).map((day) => day.key)).toEqual([
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ]);
  });
});

describe("getWindowDurationHours", () => {
  test("asks for a whole day", () => {
    const [today] = getGuideDays(MIDDAY);

    expect(
      getWindowDurationHours(today ?? { endMs: 0, key: "", startMs: 0 }),
    ).toBe(24);
  });

  test("keeps a clock-change day inside the range the API accepts", () => {
    expect(
      getWindowDurationHours({ endMs: 25 * 3_600_000, key: "", startMs: 0 }),
    ).toBe(24);
    expect(
      getWindowDurationHours({ endMs: 23 * 3_600_000, key: "", startMs: 0 }),
    ).toBe(23);
  });
});

describe("getFetchedRange", () => {
  test("covers a whole day when one request can", () => {
    const [today] = getGuideDays(MIDDAY);

    expect(getFetchedRange(today ?? { endMs: 0, key: "", startMs: 0 })).toEqual(
      today,
    );
  });

  test("stops a 25-hour day where the request does, an hour short", () => {
    expect(
      getFetchedRange({ endMs: 25 * 3_600_000, key: "long", startMs: 0 }),
    ).toEqual({ endMs: 24 * 3_600_000, key: "long", startMs: 0 });
  });
});

describe("getDayIndexAt", () => {
  test("finds the day a moment belongs to", () => {
    const days = getGuideDays(MIDDAY);

    expect(getDayIndexAt(days, MIDDAY)).toBe(0);
    expect(getDayIndexAt(days, days[2]?.startMs ?? 0)).toBe(2);
  });

  test("reports nothing outside the week", () => {
    const days = getGuideDays(MIDDAY);

    expect(getDayIndexAt(days, MIDDAY - 86_400_000)).toBe(-1);
  });

  test("keeps the time of day when the viewer moves to another day", () => {
    const days = getGuideDays(new Date(2026, 4, 30, 9, 0).getTime());
    const [today, tomorrow] = days;
    const halfPastTen = (today?.startMs ?? 0) + 10.5 * 3_600_000;

    const onTomorrow = new Date(
      getTimeOnDay({
        day: tomorrow as (typeof days)[number],
        timeMs: halfPastTen,
      }),
    );

    expect(onTomorrow.getDate()).toBe(
      new Date(tomorrow?.startMs ?? 0).getDate(),
    );
    expect(onTomorrow.getHours()).toBe(10);
    expect(onTomorrow.getMinutes()).toBe(30);
  });
});
