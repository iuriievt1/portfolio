import { formatDayLabel, getGuideDays } from "@/features/full-guide";

const NOW = new Date(2026, 4, 30, 12, 0).getTime();

describe("formatDayLabel", () => {
  test("names today", () => {
    const [today] = getGuideDays(NOW);

    expect(
      formatDayLabel({ dayStartMs: today?.startMs ?? 0, nowMs: NOW }),
    ).toBe("Today 30 May");
  });

  test("gives the rest of the week its weekday", () => {
    const days = getGuideDays(NOW);

    expect(
      formatDayLabel({ dayStartMs: days[1]?.startMs ?? 0, nowMs: NOW }),
    ).toBe("Sun 31 May");
    expect(
      formatDayLabel({ dayStartMs: days[6]?.startMs ?? 0, nowMs: NOW }),
    ).toBe("Fri 5 Jun");
  });

  test("does not call the same date in another month today", () => {
    const days = getGuideDays(new Date(2026, 5, 30, 12, 0).getTime());

    expect(
      formatDayLabel({ dayStartMs: days[0]?.startMs ?? 0, nowMs: NOW }),
    ).toBe("Tue 30 Jun");
  });
});
