import {
  formatEpisodePosition,
  formatProgrammeOnAirWindow,
  formatProgrammeRange,
  getProgrammeEndDateTime,
} from "@/utils/programme";

const TIME_ZONE = "Europe/London";

describe("formatEpisodePosition", () => {
  test("formats complete episode coordinates", () => {
    expect(
      formatEpisodePosition({ episodeNumber: "2", seasonNumber: "1" }),
    ).toBe("S1 E2");
  });

  test.each([
    [{ seasonNumber: "1" }, "S1"],
    [{ episodeNumber: "2" }, "E2"],
  ])("collapses around a missing coordinate", (metadata, expected) => {
    expect(formatEpisodePosition(metadata)).toBe(expected);
  });

  test("trims the supplied coordinates", () => {
    expect(
      formatEpisodePosition({ episodeNumber: " 2 ", seasonNumber: " 1 " }),
    ).toBe("S1 E2");
  });

  test("returns undefined when every coordinate is missing or blank", () => {
    expect(
      formatEpisodePosition({ episodeNumber: " ", seasonNumber: undefined }),
    ).toBeUndefined();
  });
});

describe("formatProgrammeRange", () => {
  test("formats the on-air window as a 24-hour range", () => {
    expect(
      formatProgrammeRange({
        endsAt: "2026-06-10T14:00:00.000Z",
        startsAt: "2026-06-10T13:00:00.000Z",
        timeZone: TIME_ZONE,
      }),
    ).toBe("14:00 - 15:00");
  });

  test("returns an empty string when either end is missing", () => {
    expect(
      formatProgrammeRange({
        endsAt: undefined,
        startsAt: "2026-06-10T13:00:00.000Z",
        timeZone: TIME_ZONE,
      }),
    ).toBe("");
    expect(
      formatProgrammeRange({
        endsAt: "2026-06-10T14:00:00.000Z",
        startsAt: undefined,
        timeZone: TIME_ZONE,
      }),
    ).toBe("");
  });

  test("returns an empty string when a date cannot be parsed", () => {
    expect(
      formatProgrammeRange({
        endsAt: "not-a-date",
        startsAt: "2026-06-10T13:00:00.000Z",
        timeZone: TIME_ZONE,
      }),
    ).toBe("");
  });
});

describe("getProgrammeEndDateTime", () => {
  test("prefers the expiration date when present", () => {
    expect(
      getProgrammeEndDateTime({
        expirationDateTime: "2026-06-10T14:00:00.000Z",
        id: "programme-1",
        startDateTime: "2026-06-10T13:00:00.000Z",
        title: "Programme",
      }),
    ).toBe("2026-06-10T14:00:00.000Z");
  });

  test("derives the end from the start plus the duration", () => {
    expect(
      getProgrammeEndDateTime({
        durationSeconds: 3600,
        id: "programme-1",
        startDateTime: "2026-06-10T13:00:00.000Z",
        title: "Programme",
      }),
    ).toBe("2026-06-10T14:00:00.000Z");
  });

  test("returns undefined without a start or a duration", () => {
    expect(
      getProgrammeEndDateTime({ id: "programme-1", title: "Programme" }),
    ).toBeUndefined();
  });
});

describe("formatProgrammeOnAirWindow", () => {
  test("derives the end from the duration when the feed omits one", () => {
    expect(
      formatProgrammeOnAirWindow(
        {
          durationSeconds: 3600,
          id: "programme-1",
          startDateTime: "2026-06-10T13:00:00.000Z",
          title: "Programme",
        },
        TIME_ZONE,
      ),
    ).toBe("14:00 - 15:00");
  });

  test("returns an empty string when the end cannot be derived", () => {
    expect(
      formatProgrammeOnAirWindow(
        {
          id: "programme-1",
          startDateTime: "2026-06-10T13:00:00.000Z",
          title: "Programme",
        },
        TIME_ZONE,
      ),
    ).toBe("");
  });
});
