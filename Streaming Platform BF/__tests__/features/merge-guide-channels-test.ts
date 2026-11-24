import type { ContentItem } from "@bfbs/common-sdk";
import type { GuideChannel } from "@/features/full-guide";
import { mergeGuideChannels } from "@/features/full-guide";
import { HOUR_MS } from "@/utils/date-time";

const DAY_START_MS = new Date(2026, 8, 3).getTime();

function cell(id: string, fromHours: number, toHours: number) {
  const startMs = DAY_START_MS + fromHours * HOUR_MS;

  return {
    endMs: DAY_START_MS + toHours * HOUR_MS,
    id,
    programme: { contentType: "programme", id, title: id } as ContentItem,
    startMs,
  };
}

function channel(cells: GuideChannel["cells"]): GuideChannel {
  return { cells, id: "one", logoUrl: undefined, name: "One" };
}

describe("mergeGuideChannels", () => {
  test("joins the loaded days into one row", () => {
    const merged = mergeGuideChannels({
      "day-1": [channel([cell("late", 22, 23)])],
      "day-2": [channel([cell("early", 25, 26)])],
    });

    expect(merged[0]?.cells.map((entry) => entry.id)).toEqual([
      "late",
      "early",
    ]);
  });

  test("keeps one entry when both days carry it", () => {
    const merged = mergeGuideChannels({
      "day-1": [channel([cell("overnight", 23, 25)])],
      "day-2": [channel([cell("overnight", 23, 25)])],
    });

    expect(merged[0]?.cells).toHaveLength(1);
  });

  test("keeps a repeat airing of the same programme", () => {
    const merged = mergeGuideChannels({
      "day-1": [
        channel([
          { ...cell("news-6", 6, 7), programme: cell("news", 6, 7).programme },
          {
            ...cell("news-12", 12, 13),
            programme: cell("news", 12, 13).programme,
          },
        ]),
      ],
    });

    expect(merged[0]?.cells).toHaveLength(2);
  });

  test("trims the seam so a day never starts inside the day before", () => {
    const merged = mergeGuideChannels({
      "day-1": [channel([cell("overnight", 23, 25)])],
      "day-2": [channel([cell("breakfast", 24, 27)])],
    });
    const [first, second] = merged[0]?.cells ?? [];

    expect(second?.startMs).toBe(first?.endMs);
  });
});
