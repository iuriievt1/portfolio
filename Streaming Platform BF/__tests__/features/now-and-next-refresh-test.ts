import {
  getBoundaryRefreshIntervalMs,
  getProgrammeGuideRefetchDelayMs,
  NOW_AND_NEXT_FALLBACK_REFRESH_INTERVAL_MS,
  NOW_AND_NEXT_MIN_REFRESH_INTERVAL_MS,
  shouldRefreshAtBoundary,
} from "@/features/live-channels/now-and-next-refresh";

const NOW_MS = Date.parse("2026-06-08T09:15:00.000Z");

describe("getBoundaryRefreshIntervalMs", () => {
  it("waits until a future boundary", () => {
    expect(getBoundaryRefreshIntervalMs(NOW_MS + 5000, NOW_MS)).toBe(5000);
  });

  it("clamps a nearby future boundary to the minimum interval", () => {
    expect(getBoundaryRefreshIntervalMs(NOW_MS + 500, NOW_MS)).toBe(
      NOW_AND_NEXT_MIN_REFRESH_INTERVAL_MS,
    );
  });

  it("falls back when there is no boundary", () => {
    expect(getBoundaryRefreshIntervalMs(null, NOW_MS)).toBe(
      NOW_AND_NEXT_FALLBACK_REFRESH_INTERVAL_MS,
    );
  });

  it("falls back when the boundary has already passed", () => {
    expect(getBoundaryRefreshIntervalMs(NOW_MS - 10_000, NOW_MS)).toBe(
      NOW_AND_NEXT_FALLBACK_REFRESH_INTERVAL_MS,
    );
  });
});

describe("shouldRefreshAtBoundary", () => {
  it("is true once the boundary has passed", () => {
    expect(shouldRefreshAtBoundary(NOW_MS - 1, NOW_MS)).toBe(true);
  });

  it("is false before the boundary", () => {
    expect(shouldRefreshAtBoundary(NOW_MS + 1, NOW_MS)).toBe(false);
  });

  it("is false without a boundary", () => {
    expect(shouldRefreshAtBoundary(undefined, NOW_MS)).toBe(false);
  });
});

describe("getProgrammeGuideRefetchDelayMs", () => {
  it("uses the earliest programme end across channels", () => {
    const guide = {
      channels: [
        {
          programmes: [
            {
              expirationDateTime: "2026-06-08T09:20:00.000Z",
              id: "a",
              title: "A",
            },
          ],
        },
        {
          programmes: [
            {
              expirationDateTime: "2026-06-08T09:17:00.000Z",
              id: "b",
              title: "B",
            },
          ],
        },
      ],
    };

    expect(getProgrammeGuideRefetchDelayMs(guide, NOW_MS)).toBe(2 * 60_000);
  });

  it("selects the programme that is actually on air", () => {
    const guide = {
      channels: [
        {
          programmes: [
            {
              expirationDateTime: "2026-06-08T09:00:00.000Z",
              id: "stale",
              startDateTime: "2026-06-08T08:30:00.000Z",
              title: "Stale programme",
            },
            {
              expirationDateTime: "2026-06-08T09:30:00.000Z",
              id: "current",
              startDateTime: "2026-06-08T09:00:00.000Z",
              title: "Current programme",
            },
          ],
        },
      ],
    };

    expect(getProgrammeGuideRefetchDelayMs(guide, NOW_MS)).toBe(15 * 60_000);
  });

  it("uses the fallback interval when all programme boundaries are stale", () => {
    const guide = {
      channels: [
        {
          programmes: [
            {
              expirationDateTime: "2026-06-08T09:00:00.000Z",
              id: "stale",
              startDateTime: "2026-06-08T08:30:00.000Z",
              title: "Stale programme",
            },
          ],
        },
      ],
    };

    expect(getProgrammeGuideRefetchDelayMs(guide, NOW_MS)).toBe(
      NOW_AND_NEXT_FALLBACK_REFRESH_INTERVAL_MS,
    );
  });

  it("falls back when the guide has no channels", () => {
    expect(getProgrammeGuideRefetchDelayMs({ channels: [] }, NOW_MS)).toBe(
      NOW_AND_NEXT_FALLBACK_REFRESH_INTERVAL_MS,
    );
  });
});
