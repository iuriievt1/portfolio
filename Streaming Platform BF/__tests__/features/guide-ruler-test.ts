import { getGuideDays, getTimeline } from "@/features/full-guide";
import {
  getRulerMarks,
  isUnderLiveClock,
} from "@/features/full-guide/utils/guide-ruler";
import { HOUR_MS, MINUTE_MS } from "@/utils/date-time";

const DAYS = getGuideDays(new Date(2026, 4, 30, 12, 0).getTime());
const DAY = DAYS[0] ?? { endMs: 0, key: "", startMs: 0 };
const PIXELS_PER_MINUTE = 4;
const VIEWPORT_WIDTH = 375;

describe("getRulerMarks", () => {
  test("lands every mark on a local half hour, whatever the week starts at", () => {
    const timeline = getTimeline(
      DAYS,
      DAY.startMs + 10 * HOUR_MS + 7 * MINUTE_MS,
    );
    const marks = getRulerMarks({
      pixelsPerMinute: PIXELS_PER_MINUTE,
      scrollX: 0,
      timeline,
      viewportWidth: VIEWPORT_WIDTH,
    });

    expect(marks[0]).toBe(DAY.startMs + 10.5 * HOUR_MS);
    expect(
      marks.every((markMs) => new Date(markMs).getMinutes() % 30 === 0),
    ).toBe(true);
  });

  test("draws marks through the full fling buffer around the viewport", () => {
    const timeline = getTimeline(DAYS, DAY.startMs);
    const marks = getRulerMarks({
      pixelsPerMinute: PIXELS_PER_MINUTE,
      scrollX: 4 * 60 * PIXELS_PER_MINUTE,
      timeline,
      viewportWidth: VIEWPORT_WIDTH,
    });
    const hours = marks.map((markMs) => (markMs - DAY.startMs) / HOUR_MS);

    expect(hours[0]).toBeGreaterThanOrEqual(
      Math.max(0, 4 - (6 * VIEWPORT_WIDTH) / PIXELS_PER_MINUTE / 60),
    );
    expect(hours.at(-1)).toBeLessThanOrEqual(
      4 + (7 * VIEWPORT_WIDTH) / PIXELS_PER_MINUTE / 60,
    );
  });

  test("never marks before the week begins or after it ends", () => {
    const timeline = getTimeline(DAYS, DAY.startMs);
    const marks = getRulerMarks({
      pixelsPerMinute: PIXELS_PER_MINUTE,
      scrollX: 0,
      timeline,
      viewportWidth: VIEWPORT_WIDTH,
    });

    expect(marks[0]).toBe(DAY.startMs);
    expect(marks.every((markMs) => markMs <= timeline.endMs)).toBe(true);
  });
});

describe("isUnderLiveClock", () => {
  test("steps a mark aside only while it would overlap the clock", () => {
    expect(
      isUnderLiveClock({ clockLeft: 500, clockWidth: 40, markLeft: 490 }),
    ).toBe(true);
    expect(
      isUnderLiveClock({ clockLeft: 500, clockWidth: 40, markLeft: 560 }),
    ).toBe(false);
    expect(
      isUnderLiveClock({ clockLeft: 500, clockWidth: 40, markLeft: 430 }),
    ).toBe(false);
  });
});
