import type { MiniGuideProgramme } from "@/features/mini-guide/types";
import {
  formatProgrammeMetadata,
  formatProgrammeTimeRange,
  getProgrammeProgress,
} from "@/features/mini-guide/utils/format-programme-time";
import { getMiniGuideVariant } from "@/features/mini-guide/utils/get-mini-guide-variant";

const START_MS = Date.parse("2026-06-08T09:00:00.000Z");
const END_MS = Date.parse("2026-06-08T10:00:00.000Z");

const PROGRAMME: MiniGuideProgramme = {
  endsAt: "2026-06-08T10:00:00.000Z",
  startsAt: "2026-06-08T09:00:00.000Z",
  title: "The Chase",
};

describe("formatProgrammeTimeRange", () => {
  test("formats the broadcast window as HH:MM - HH:MM", () => {
    expect(formatProgrammeTimeRange(PROGRAMME, "Europe/London")).toBe(
      "10:00 - 11:00",
    );
  });

  test("shows only the start time when the end is unknown", () => {
    expect(
      formatProgrammeTimeRange(
        { startsAt: PROGRAMME.startsAt, title: "The Chase" },
        "Europe/London",
      ),
    ).toBe("10:00");
  });

  test("returns an empty string when the start is invalid", () => {
    expect(
      formatProgrammeTimeRange(
        { startsAt: "not-a-date", title: "The Chase" },
        "Europe/London",
      ),
    ).toBe("");
  });
});

describe("formatProgrammeMetadata", () => {
  test("appends the season and episode to the time range", () => {
    expect(
      formatProgrammeMetadata(
        { ...PROGRAMME, episodeNumber: "21", seasonNumber: "1" },
        "Europe/London",
      ),
    ).toBe("10:00 - 11:00 | S1 E21");
  });

  test("returns only the time range when there is no episode info", () => {
    expect(formatProgrammeMetadata(PROGRAMME, "Europe/London")).toBe(
      "10:00 - 11:00",
    );
  });

  test("returns only the episode when the time is unavailable", () => {
    expect(
      formatProgrammeMetadata(
        {
          episodeNumber: "21",
          seasonNumber: "1",
          startsAt: "not-a-date",
          title: "The Chase",
        },
        "Europe/London",
      ),
    ).toBe("S1 E21");
  });
});

describe("getProgrammeProgress", () => {
  test("returns the fraction elapsed within the window", () => {
    expect(
      getProgrammeProgress(PROGRAMME, START_MS + 30 * 60 * 1000),
    ).toBeCloseTo(0.5);
  });

  test("clamps to 0 before the window starts", () => {
    expect(getProgrammeProgress(PROGRAMME, START_MS - 60 * 1000)).toBe(0);
  });

  test("clamps to 1 after the window ends", () => {
    expect(getProgrammeProgress(PROGRAMME, END_MS + 60 * 1000)).toBe(1);
  });

  test("returns 0 when the end time is missing", () => {
    expect(
      getProgrammeProgress(
        { startsAt: PROGRAMME.startsAt, title: "The Chase" },
        START_MS + 30 * 60 * 1000,
      ),
    ).toBe(0);
  });

  test("returns 0 when the window has no positive duration", () => {
    expect(
      getProgrammeProgress(
        {
          endsAt: PROGRAMME.startsAt,
          startsAt: PROGRAMME.startsAt,
          title: "The Chase",
        },
        START_MS,
      ),
    ).toBe(0);
  });
});

describe("getMiniGuideVariant", () => {
  test("resolves to mobile for a phone in any orientation", () => {
    expect(getMiniGuideVariant({ isLandscape: false, isTablet: false })).toBe(
      "mobile",
    );
    expect(getMiniGuideVariant({ isLandscape: true, isTablet: false })).toBe(
      "mobile",
    );
  });

  test("resolves tablet orientation variants", () => {
    expect(getMiniGuideVariant({ isLandscape: false, isTablet: true })).toBe(
      "tablet-portrait",
    );
    expect(getMiniGuideVariant({ isLandscape: true, isTablet: true })).toBe(
      "tablet-landscape",
    );
  });
});
