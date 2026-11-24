import type { ContentItem } from "@bfbs/common-sdk";

import {
  getContentChannelId,
  getContentPlaybackType,
  getProviderContentType,
  getRailPlaybackType,
  resolveLiveChannelId,
} from "@/features/content-rails/content";

const createItem = (overrides: Partial<ContentItem>): ContentItem => ({
  id: "item-1",
  title: "Item",
  ...overrides,
});

describe("getProviderContentType", () => {
  it("returns the typed provider content type", () => {
    expect(getProviderContentType({ contentType: "linearStandalone" })).toBe(
      "linearStandalone",
    );
  });

  it("normalises provider content type casing", () => {
    expect(getProviderContentType({ contentType: "LinearStandalone" })).toBe(
      "linearStandalone",
    );
    expect(getProviderContentType({ contentType: "VOD" })).toBe("vod");
  });

  it("returns undefined when the content type is missing or unsupported", () => {
    expect(getProviderContentType({})).toBeUndefined();
    expect(getProviderContentType({ contentType: "category" })).toBeUndefined();
    expect(getProviderContentType({ contentType: "genre" })).toBeUndefined();
    expect(getProviderContentType({ contentType: "mystery" })).toBeUndefined();
  });
});

describe("getContentChannelId", () => {
  it("prefers an explicit channelId", () => {
    expect(getContentChannelId({ channelId: "channel-1", id: "item-1" })).toBe(
      "channel-1",
    );
  });

  it("falls back to the embedded channel id", () => {
    expect(
      getContentChannelId({
        channel: { id: "channel-2", name: "Two" },
        id: "item-1",
      }),
    ).toBe("channel-2");
  });

  it("uses the item id when the item itself is a channel", () => {
    expect(
      getContentChannelId({ contentType: "channel", id: "channel-3" }),
    ).toBe("channel-3");
  });

  it("returns undefined for a non-channel item without channel data", () => {
    expect(
      getContentChannelId({ contentType: "standalone", id: "item-1" }),
    ).toBeUndefined();
  });
});

describe("getContentPlaybackType", () => {
  it("classifies a channel item as live", () => {
    expect(getContentPlaybackType(createItem({ contentType: "channel" }))).toBe(
      "live",
    );
  });

  it("classifies a linear standalone item as live", () => {
    expect(
      getContentPlaybackType(createItem({ contentType: "linearStandalone" })),
    ).toBe("live");
  });

  it("classifies an episode item as live when it has a channel", () => {
    expect(
      getContentPlaybackType(
        createItem({ channelId: "channel-1", contentType: "episode" }),
      ),
    ).toBe("live");
  });

  it("excludes episode items without a channel", () => {
    expect(
      getContentPlaybackType(createItem({ contentType: "episode" })),
    ).toBeUndefined();
  });

  it("classifies on-demand content types as vod", () => {
    expect(
      getContentPlaybackType(createItem({ contentType: "standalone" })),
    ).toBe("vod");
    expect(getContentPlaybackType(createItem({ contentType: "VOD" }))).toBe(
      "vod",
    );
  });

  it("excludes external-only items", () => {
    expect(
      getContentPlaybackType(
        createItem({
          contentType: "standalone",
          externalViewingOptions: { externalOnly: true },
        }),
      ),
    ).toBeUndefined();
  });

  it("returns undefined for non-playable content types", () => {
    for (const contentType of ["season", "show", "group", "mystery"]) {
      expect(
        getContentPlaybackType(createItem({ contentType })),
      ).toBeUndefined();
    }
  });
});

describe("getRailPlaybackType", () => {
  it("classifies a rail of channels as live", () => {
    expect(
      getRailPlaybackType({
        items: [createItem({ contentType: "channel" })],
      }),
    ).toBe("live");
  });

  it("classifies a rail of on-demand items as vod", () => {
    expect(
      getRailPlaybackType({
        items: [createItem({ contentType: "standalone" })],
      }),
    ).toBe("vod");
  });

  it("classifies channel-less episode rails as VOD", () => {
    expect(
      getRailPlaybackType({
        items: [createItem({ contentType: "episode" })],
      }),
    ).toBe("vod");
  });

  it("prefers live when live and vod items tie", () => {
    expect(
      getRailPlaybackType({
        items: [
          createItem({ contentType: "channel", id: "a" }),
          createItem({ contentType: "standalone", id: "b" }),
        ],
      }),
    ).toBe("live");
  });

  it("classifies a rail of shows or seasons as vod", () => {
    expect(
      getRailPlaybackType({ items: [createItem({ contentType: "show" })] }),
    ).toBe("vod");
    expect(
      getRailPlaybackType({ items: [createItem({ contentType: "season" })] }),
    ).toBe("vod");
  });

  it("returns undefined for a rail without playable items", () => {
    expect(
      getRailPlaybackType({ items: [createItem({ contentType: "group" })] }),
    ).toBeUndefined();
  });
});

describe("resolveLiveChannelId", () => {
  it("returns the channel airing a programme that omits its channel id", () => {
    const channels = [
      {
        currentProgramme: { id: "programme-1", title: "Now" },
        id: "channel-1",
        name: "Channel One",
      },
    ];

    expect(
      resolveLiveChannelId(createItem({ id: "programme-1" }), channels),
    ).toBe("channel-1");
  });

  it("returns undefined when no channel is airing the programme", () => {
    expect(
      resolveLiveChannelId(createItem({ id: "orphan" }), []),
    ).toBeUndefined();
  });
});
