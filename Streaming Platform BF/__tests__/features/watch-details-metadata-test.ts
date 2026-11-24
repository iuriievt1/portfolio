import {
  formatRuntime,
  getAssetMetadataItems,
  getContinueWatching,
  getLeavingLabel,
  hasWatchDetailsMetadata,
  isLeavingSoon,
  normalizeAgeRating,
  resolveAgeRating,
} from "@/features/watch-details/utils/watch-details-metadata";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("formatRuntime", () => {
  test("formats hours and minutes", () => {
    expect(formatRuntime(6360)).toBe("1h 46m");
  });

  test("formats minutes only", () => {
    expect(formatRuntime(2760)).toBe("46m");
  });

  test("drops minutes when zero", () => {
    expect(formatRuntime(3600)).toBe("1h");
  });

  test("returns undefined for missing or non-positive durations", () => {
    expect(formatRuntime(undefined)).toBeUndefined();
    expect(formatRuntime(0)).toBeUndefined();
    expect(formatRuntime(-5)).toBeUndefined();
  });
});

describe("getAssetMetadataItems", () => {
  test("returns genre, year and runtime when present", () => {
    expect(
      getAssetMetadataItems({
        durationSeconds: 6360,
        genres: ["Dramedy"],
        productionYear: 1994,
      }),
    ).toEqual(["Dramedy", "1994", "1h 46m"]);
  });

  test("omits missing fields and closes up", () => {
    expect(getAssetMetadataItems({ productionYear: 1994 })).toEqual(["1994"]);
  });

  test("returns an empty list when nothing is present", () => {
    expect(getAssetMetadataItems({})).toEqual([]);
  });

  test("falls back to contentDurationSeconds", () => {
    expect(getAssetMetadataItems({ contentDurationSeconds: 3600 })).toEqual([
      "1h",
    ]);
  });
});

describe("isLeavingSoon", () => {
  const nowMs = Date.parse("2026-08-07T12:00:00.000Z");

  test("is true within the 30 day window", () => {
    expect(
      isLeavingSoon({
        expirationDateTime: new Date(nowMs + 10 * DAY_MS).toISOString(),
        nowMs,
      }),
    ).toBe(true);
  });

  test("is false beyond 30 days", () => {
    expect(
      isLeavingSoon({
        expirationDateTime: new Date(nowMs + 40 * DAY_MS).toISOString(),
        nowMs,
      }),
    ).toBe(false);
  });

  test("is false once expired", () => {
    expect(
      isLeavingSoon({
        expirationDateTime: new Date(nowMs - DAY_MS).toISOString(),
        nowMs,
      }),
    ).toBe(false);
  });

  test("is false without an expiry date", () => {
    expect(isLeavingSoon({ expirationDateTime: undefined, nowMs })).toBe(false);
  });
});

describe("normalizeAgeRating", () => {
  test("maps known labels", () => {
    expect(normalizeAgeRating("15")).toBe("15");
    expect(normalizeAgeRating("PG")).toBe("PG");
  });

  test("normalises case and whitespace", () => {
    expect(normalizeAgeRating(" 12a ")).toBe("12A");
    expect(normalizeAgeRating("u")).toBe("U");
  });

  test("returns undefined for unknown or missing labels", () => {
    expect(normalizeAgeRating("R18")).toBeUndefined();
    expect(normalizeAgeRating(undefined)).toBeUndefined();
    expect(normalizeAgeRating("")).toBeUndefined();
  });
});

describe("resolveAgeRating", () => {
  test("uses a BBFC label when present", () => {
    expect(resolveAgeRating({ label: "15" })).toBe("15");
  });

  test("falls back to the numeric value", () => {
    expect(resolveAgeRating({ label: "Ages 13 and older", value: 12 })).toBe(
      "12",
    );
    expect(resolveAgeRating({ value: 18 })).toBe("18");
  });

  test("prefers a valid label over the value", () => {
    expect(resolveAgeRating({ label: "18", value: 12 })).toBe("18");
  });

  test("buckets any numeric value to the nearest BBFC band", () => {
    expect(resolveAgeRating({ value: 13 })).toBe("12");
    expect(resolveAgeRating({ value: 16 })).toBe("15");
    expect(resolveAgeRating({ value: 20 })).toBe("18");
    expect(resolveAgeRating({ value: 8 })).toBe("PG");
    expect(resolveAgeRating({ value: 0 })).toBe("U");
  });

  test("returns undefined when there is no label or value", () => {
    expect(resolveAgeRating({})).toBeUndefined();
    expect(resolveAgeRating(null)).toBeUndefined();
    expect(resolveAgeRating(undefined)).toBeUndefined();
  });
});

describe("getContinueWatching", () => {
  test("returns progress and remaining for a partially watched asset", () => {
    expect(
      getContinueWatching({
        durationSeconds: 6360,
        lastPlayPositionSeconds: 1140,
      }),
    ).toEqual({ progress: 1140 / 6360, remainingSeconds: 5220 });
  });

  test("falls back to contentDurationSeconds", () => {
    expect(
      getContinueWatching({
        contentDurationSeconds: 120,
        lastPlayPositionSeconds: 60,
      }),
    ).toEqual({ progress: 0.5, remainingSeconds: 60 });
  });

  test("returns undefined when not started, finished, or missing data", () => {
    expect(getContinueWatching({ durationSeconds: 100 })).toBeUndefined();
    expect(
      getContinueWatching({ durationSeconds: 100, lastPlayPositionSeconds: 0 }),
    ).toBeUndefined();
    expect(
      getContinueWatching({
        durationSeconds: 100,
        lastPlayPositionSeconds: 100,
      }),
    ).toBeUndefined();
    expect(
      getContinueWatching({ lastPlayPositionSeconds: 50 }),
    ).toBeUndefined();
  });
});

describe("hasWatchDetailsMetadata", () => {
  test("is true with only a year", () => {
    expect(
      hasWatchDetailsMetadata({ id: "a", productionYear: 1994, title: "A" }),
    ).toBe(true);
  });

  test("is true with only a supported rating", () => {
    expect(
      hasWatchDetailsMetadata({
        id: "a",
        parentalRating: { label: "12" },
        title: "A",
      }),
    ).toBe(true);
  });

  test("is false with nothing to show", () => {
    expect(hasWatchDetailsMetadata({ genres: [], id: "a", title: "A" })).toBe(
      false,
    );
  });
});

describe("getLeavingLabel", () => {
  const nowMs = Date.parse("2026-10-06T12:00:00.000Z");

  test("shows the date and time within the 30 day window", () => {
    expect(
      getLeavingLabel({
        expirationDateTime: "2026-10-16T14:00:00.000Z",
        nowMs,
        timeZone: "Europe/London",
      }),
    ).toBe("Leaving on 16 October at 15:00");
  });

  test("uses the selected time zone", () => {
    expect(
      getLeavingLabel({
        expirationDateTime: "2026-10-16T14:00:00.000Z",
        nowMs,
        timeZone: "UTC",
      }),
    ).toBe("Leaving on 16 October at 14:00");
  });

  test("is undefined beyond 30 days, once expired, or without a date", () => {
    expect(
      getLeavingLabel({
        expirationDateTime: new Date(nowMs + 40 * DAY_MS).toISOString(),
        nowMs,
        timeZone: "UTC",
      }),
    ).toBeUndefined();
    expect(
      getLeavingLabel({
        expirationDateTime: new Date(nowMs - DAY_MS).toISOString(),
        nowMs,
        timeZone: "UTC",
      }),
    ).toBeUndefined();
    expect(
      getLeavingLabel({
        expirationDateTime: undefined,
        nowMs,
        timeZone: "UTC",
      }),
    ).toBeUndefined();
  });
});
