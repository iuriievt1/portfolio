import type { ContentItem } from "@bfbs/common-sdk";
import type { GuideChannel, GuideDay } from "@/features/full-guide";
import { fillGuideGaps } from "@/features/full-guide";
import { HOUR_MS } from "@/utils/date-time";

const DAY_START_MS = new Date(2026, 8, 3).getTime();

function day(index: number): GuideDay {
  const startMs = DAY_START_MS + index * 24 * HOUR_MS;

  return { endMs: startMs + 24 * HOUR_MS, key: `day-${index}`, startMs };
}

function cell(id: string, fromHours: number, toHours: number) {
  return {
    endMs: DAY_START_MS + toHours * HOUR_MS,
    id,
    programme: { contentType: "programme", id, title: id } as ContentItem,
    startMs: DAY_START_MS + fromHours * HOUR_MS,
  };
}

function channel(cells: GuideChannel["cells"]): GuideChannel {
  return { cells, id: "one", logoUrl: undefined, name: "One" };
}

function windows(channels: GuideChannel[]) {
  return channels[0]?.cells.map((entry) => [
    entry.programme.title,
    (entry.startMs - DAY_START_MS) / HOUR_MS,
    (entry.endMs - DAY_START_MS) / HOUR_MS,
  ]);
}

describe("fillGuideGaps", () => {
  test("fills a hole between programmes with a card of its own", () => {
    const filled = fillGuideGaps(
      [channel([cell("breakfast", 0, 10), cell("lunch", 11, 24)])],
      [day(0)],
    );

    expect(windows(filled)).toEqual([
      ["breakfast", 0, 10],
      ["Programme Info Not Available", 10, 11],
      ["lunch", 11, 24],
    ]);
  });

  test("fills the day before the first programme and after the last", () => {
    const filled = fillGuideGaps([channel([cell("show", 6, 22)])], [day(0)]);

    expect(windows(filled)).toEqual([
      ["Programme Info Not Available", 0, 6],
      ["show", 6, 22],
      ["Programme Info Not Available", 22, 24],
    ]);
  });

  test("runs one card across midnight when both days are loaded", () => {
    const filled = fillGuideGaps(
      [channel([cell("late", 20, 23), cell("early", 30, 48)])],
      [day(1), day(0)],
    );

    expect(windows(filled)).toEqual([
      ["Programme Info Not Available", 0, 20],
      ["late", 20, 23],
      ["Programme Info Not Available", 23, 30],
      ["early", 30, 48],
    ]);
  });

  test("leaves a day that is still loading blank", () => {
    const filled = fillGuideGaps(
      [channel([cell("late", 20, 23), cell("early", 30, 48)])],
      [day(1)],
    );

    expect(windows(filled)).toEqual([
      ["late", 20, 23],
      ["Programme Info Not Available", 24, 30],
      ["early", 30, 48],
    ]);
  });

  test("fills each loaded day on its own when the day between is missing", () => {
    const filled = fillGuideGaps([channel([])], [day(0), day(2)]);

    expect(windows(filled)).toEqual([
      ["Programme Info Not Available", 0, 24],
      ["Programme Info Not Available", 48, 72],
    ]);
  });

  test("fills the same holes when the programmes arrive out of order", () => {
    const filled = fillGuideGaps(
      [channel([cell("lunch", 11, 24), cell("breakfast", 0, 10)])],
      [day(0)],
    );

    expect(windows(filled)).toEqual([
      ["breakfast", 0, 10],
      ["Programme Info Not Available", 10, 11],
      ["lunch", 11, 24],
    ]);
  });

  test("leaves an unbroken schedule alone", () => {
    const cells = [cell("morning", 0, 12), cell("evening", 12, 24)];
    const filled = fillGuideGaps([channel(cells)], [day(0)]);

    expect(filled[0]?.cells).toEqual(cells);
  });

  test("leaves no sliver beside a programme that runs past the loaded edge", () => {
    const filled = fillGuideGaps(
      [channel([cell("overnight", 22, 26)])],
      [day(0)],
    );

    expect(windows(filled)).toEqual([
      ["Programme Info Not Available", 0, 22],
      ["overnight", 22, 26],
    ]);
  });

  test("adds nothing while no day has loaded", () => {
    const filled = fillGuideGaps([channel([cell("show", 6, 22)])], []);

    expect(filled[0]?.cells).toHaveLength(1);
  });

  test("gives the card what the hero and the cell print", () => {
    const [gap] = fillGuideGaps([channel([])], [day(0)])[0]?.cells ?? [];

    expect(gap).toMatchObject({
      id: `one-gap-${DAY_START_MS}`,
      programme: {
        expirationDateTime: new Date(day(0).endMs).toISOString(),
        id: `one-gap-${DAY_START_MS}`,
        startDateTime: new Date(DAY_START_MS).toISOString(),
        synopsis: "Programme info not available.",
        title: "Programme Info Not Available",
      },
    });
    expect(gap?.programme.media).toBeUndefined();
  });
});
