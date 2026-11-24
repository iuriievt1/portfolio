import { getProgressFraction } from "@/features/content-rails/components/content-tile/use-programme-progress";

const START_MS = Date.parse("2026-07-20T14:00:00.000Z");
const END_MS = Date.parse("2026-07-20T15:00:00.000Z");
const HALF_WAY_MS = Date.parse("2026-07-20T14:30:00.000Z");

describe("getProgressFraction", () => {
  test("returns the elapsed fraction of the window", () => {
    expect(
      getProgressFraction({
        endMs: END_MS,
        nowMs: HALF_WAY_MS,
        startMs: START_MS,
      }),
    ).toBeCloseTo(0.5);
  });

  test("clamps to 0 before the window opens", () => {
    expect(
      getProgressFraction({
        endMs: END_MS,
        nowMs: START_MS - 1000,
        startMs: START_MS,
      }),
    ).toBe(0);
  });

  test("clamps to 1 after the window closes", () => {
    expect(
      getProgressFraction({
        endMs: END_MS,
        nowMs: END_MS + 1000,
        startMs: START_MS,
      }),
    ).toBe(1);
  });

  test("returns 0 for a window that does not move", () => {
    expect(
      getProgressFraction({
        endMs: START_MS,
        nowMs: HALF_WAY_MS,
        startMs: START_MS,
      }),
    ).toBe(0);
  });
});
