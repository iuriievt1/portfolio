import type { ContentItem } from "@bfbs/common-sdk";

import type { LiveChannel } from "@/features/live-channels";
import {
  prepareSearchResultItems,
  SEARCH_RESULTS_LIMIT,
} from "@/features/search";

const NOW = Date.parse("2026-09-23T12:00:00.000Z");

function item(
  overrides: Partial<ContentItem> & Pick<ContentItem, "id" | "title">,
): ContentItem {
  return overrides;
}

function prepare(items: ContentItem[], channels: LiveChannel[] = []) {
  return prepareSearchResultItems({ channels, items, nowMs: NOW });
}

describe("prepareSearchResultItems", () => {
  it("applies product priority while preserving provider order within groups", () => {
    const results = prepare([
      item({
        availableSinceDateTime: "2026-09-24T12:00:00.000Z",
        contentType: "standalone",
        id: "future-1",
        title: "Future one",
      }),
      item({ contentType: "channel", id: "channel-1", title: "Channel one" }),
      item({ contentType: "standalone", id: "vod-1", title: "VOD one" }),
      item({
        channelId: "channel-2",
        contentType: "linearStandalone",
        id: "event-1",
        title: "Live event",
      }),
      item({ contentType: "show", id: "show-2", title: "VOD two" }),
      item({ contentType: "channel", id: "channel-2", title: "Channel two" }),
    ]);

    expect(
      results.map(({ category, destination }) => ({ category, destination })),
    ).toEqual([
      {
        category: "currentVod",
        destination: { assetId: "vod-1", kind: "vod" },
      },
      {
        category: "currentVod",
        destination: { kind: "show", showId: "show-2" },
      },
      {
        category: "liveChannel",
        destination: { channelId: "channel-1", kind: "live" },
      },
      {
        category: "liveChannel",
        destination: { channelId: "channel-2", kind: "live" },
      },
      {
        category: "liveEvent",
        destination: { channelId: "channel-2", kind: "live" },
      },
      {
        category: "futureVod",
        destination: { assetId: "future-1", kind: "vod" },
      },
    ]);
  });

  it("collapses episode and season matches into the strongest series result", () => {
    const results = prepare([
      item({
        contentType: "episode",
        id: "episode-1",
        showId: "show-1",
        title: "Episode title",
      }),
      item({
        contentType: "season",
        id: "season-1",
        showId: "show-1",
        title: "Season title",
      }),
      item({ contentType: "show", id: "show-1", title: "Series title" }),
      item({
        contentType: "episode",
        id: "episode-2",
        showId: "show-1",
        title: "Another episode",
      }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      destination: { kind: "show", showId: "show-1" },
      tile: { title: "Series title" },
    });
  });

  it("resolves guide programmes to live playback and keeps missing-artwork content", () => {
    const programme = item({
      contentType: "episode",
      id: "programme-1",
      title: "Upcoming programme",
    });
    const channels: LiveChannel[] = [
      {
        id: "channel-1",
        name: "BFBS One",
        nextProgramme: programme,
      },
    ];

    const results = prepare(
      [
        programme,
        item({ contentType: "standalone", id: "no-art", title: "No artwork" }),
      ],
      channels,
    );

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          destination: { assetId: "no-art", kind: "vod" },
          tile: expect.objectContaining({ title: "No artwork" }),
        }),
        expect.objectContaining({
          destination: { channelId: "channel-1", kind: "live" },
          tile: expect.objectContaining({ title: "Upcoming programme" }),
        }),
      ]),
    );
    expect(
      results.find((result) => result.destination.kind === "vod")?.tile,
    ).not.toHaveProperty("media");
  });

  it("uses channel artwork for channel search results", () => {
    const channelMedia = [
      {
        height: 100,
        mimeType: "image/png",
        type: "logo",
        url: "https://example.com/logo.png",
        width: 100,
      },
    ];
    const results = prepare(
      [
        item({
          contentType: "channel",
          id: "channel-1",
          media: [
            {
              height: 200,
              mimeType: "image/png",
              type: "poster",
              url: "https://example.com/poster.png",
              width: 200,
            },
          ],
          title: "Search channel",
        }),
      ],
      [{ id: "channel-1", media: channelMedia, name: "Homepage channel" }],
    );

    expect(results[0]).toMatchObject({
      tile: {
        contentType: "channel",
        media: [{ url: "https://example.com/logo.png" }],
        title: "Homepage channel",
      },
    });
  });

  it("omits unsupported, external-only, and unresolvable content", () => {
    const results = prepare([
      item({ contentType: "group", id: "group", title: "Group" }),
      item({ contentType: "genre", id: "genre", title: "Genre" }),
      item({
        contentType: "standalone",
        externalViewingOptions: { externalOnly: true },
        id: "external",
        title: "External",
      }),
      item({
        contentType: "linearStandalone",
        id: "unresolved-event",
        title: "Unresolved event",
      }),
      item({
        contentType: "episode",
        id: "unresolved-episode",
        title: "Unresolved episode",
      }),
    ]);

    expect(results).toEqual([]);
  });

  it("limits the prepared grid to 30 items without mutating the SDK response", () => {
    const items = Array.from({ length: SEARCH_RESULTS_LIMIT + 5 }, (_, index) =>
      item({
        contentType: "standalone",
        id: `vod-${index}`,
        title: `VOD ${index}`,
      }),
    );
    const snapshot = [...items];

    const results = prepare(items);

    expect(results).toHaveLength(SEARCH_RESULTS_LIMIT);
    expect(items).toEqual(snapshot);
    expect(items[0]?.id).toBe("vod-0");
  });
});
