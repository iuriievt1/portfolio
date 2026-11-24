import type { Channel, ContentItem } from "@bfbs/common-sdk";
import { getGuideDays, toGuideChannels } from "@/features/full-guide";

const [day] = getGuideDays(new Date(2026, 4, 30, 12, 0).getTime());
const DAY = day ?? { endMs: 0, key: "", startMs: 0 };

function at(hours: number, minutes = 0) {
  return new Date(DAY.startMs + (hours * 60 + minutes) * 60_000).toISOString();
}

function cellId(channelId: string, startHours: number) {
  return `${channelId}-${DAY.startMs + startHours * 3_600_000}`;
}

function programme(
  id: string,
  startHours: number,
  endHours: number,
): ContentItem {
  return {
    contentType: "programme",
    expirationDateTime: at(endHours),
    id,
    startDateTime: at(startHours),
    title: `Programme ${id}`,
  } as ContentItem;
}

function channel(id: string, overrides: Partial<Channel> = {}): Channel {
  return {
    id,
    logicalChannelNumber: 1,
    name: `Channel ${id}`,
    ...overrides,
  } as Channel;
}

describe("toGuideChannels", () => {
  test("keeps the line-up order and channel identity", () => {
    const channels = toGuideChannels({
      channels: [
        channel("two", { logicalChannelNumber: 2 }),
        channel("one", { logicalChannelNumber: 1 }),
      ],
      guide: { channels: [] },
    });

    expect(channels.map((entry) => entry.id)).toEqual(["one", "two"]);
    expect(channels[0]?.name).toBe("Channel one");
  });

  test("positions programmes by their own times", () => {
    const [entry] = toGuideChannels({
      channels: [channel("one")],
      guide: {
        channels: [{ channelId: "one", programmes: [programme("a", 10, 11)] }],
      },
    });
    const cell = entry?.cells.find(
      (candidate) => candidate.id === cellId("one", 10),
    );

    expect(cell?.startMs).toBe(DAY.startMs + 10 * 3_600_000);
    expect(cell?.endMs).toBe(DAY.startMs + 11 * 3_600_000);
  });

  test("derives the end when the feed omits it", () => {
    const withoutEnd = {
      contentType: "programme",
      id: "a",
      startDateTime: at(10),
      streamingDurationSeconds: 1800,
      title: "Programme a",
    } as ContentItem;

    const [entry] = toGuideChannels({
      channels: [channel("one")],
      guide: { channels: [{ channelId: "one", programmes: [withoutEnd] }] },
    });

    expect(entry?.cells[0]).toMatchObject({
      endMs: DAY.startMs + 10.5 * 3_600_000,
      id: cellId("one", 10),
    });
  });

  test("keeps only the programmes the guide carries", () => {
    const [entry] = toGuideChannels({
      channels: [channel("one")],
      guide: {
        channels: [
          {
            channelId: "one",
            programmes: [programme("a", 10, 11), programme("b", 12, 13)],
          },
        ],
      },
    });
    expect(entry?.cells.map((cell) => cell.id)).toEqual([
      cellId("one", 10),
      cellId("one", 12),
    ]);
  });

  test("names a cell by its airing, so a repeat of a programme keeps its own", () => {
    const [entry] = toGuideChannels({
      channels: [channel("one")],
      guide: {
        channels: [
          {
            channelId: "one",
            programmes: [programme("news", 6, 7), programme("news", 12, 13)],
          },
        ],
      },
    });

    expect(entry?.cells.map((cell) => cell.id)).toEqual([
      cellId("one", 6),
      cellId("one", 12),
    ]);
  });

  test("leaves a channel with nothing scheduled empty", () => {
    const [entry] = toGuideChannels({
      channels: [channel("one")],
      guide: { channels: [] },
    });

    expect(entry?.cells).toEqual([]);
  });

  test("trims overlapping entries so the row stays a single line", () => {
    const [entry] = toGuideChannels({
      channels: [channel("one")],
      guide: {
        channels: [
          {
            channelId: "one",
            programmes: [programme("a", 10, 12), programme("b", 11, 13)],
          },
        ],
      },
    });
    expect(entry?.cells.map((cell) => cell.id)).toEqual([
      cellId("one", 10),
      cellId("one", 11),
    ]);
    expect(entry?.cells[1]?.startMs).toBe(DAY.startMs + 12 * 3_600_000);
  });

  test("drops entries the grid cannot place", () => {
    const unusable = {
      contentType: "programme",
      id: "a",
      title: "a",
    } as ContentItem;

    const [entry] = toGuideChannels({
      channels: [channel("one")],
      guide: { channels: [{ channelId: "one", programmes: [unusable] }] },
    });

    expect(entry?.cells).toEqual([]);
  });

  test("leaves the logo undefined when the channel has none", () => {
    const [entry] = toGuideChannels({
      channels: [channel("one")],
      guide: { channels: [] },
    });

    expect(entry?.logoUrl).toBeUndefined();
  });
});
