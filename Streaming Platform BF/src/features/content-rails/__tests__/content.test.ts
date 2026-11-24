import { ContentCategoryTemplate, type ContentItem } from "@bfbs/common-sdk";

import {
  getContentChannelId,
  getContentDurationSeconds,
  getContentPlaybackType,
  getProviderContentType,
  getSeriesShowId,
  handleRailItemPress,
} from "../content";

function createItem(
  overrides: Partial<ContentItem> & Pick<ContentItem, "id" | "title">,
): ContentItem {
  return overrides;
}

describe("content utilities", () => {
  it("resolves typed provider content types", () => {
    expect(
      getProviderContentType(
        createItem({ contentType: "standalone", id: "1", title: "VOD" }),
      ),
    ).toBe("standalone");
    expect(
      getProviderContentType(
        createItem({ contentType: "STANDALONE", id: "2", title: "VOD" }),
      ),
    ).toBe("standalone");
    expect(
      getProviderContentType(
        createItem({ contentType: "VOD", id: "3", title: "VOD" }),
      ),
    ).toBe("vod");
  });

  it("resolves channel ids from explicit, nested, and channel content", () => {
    expect(
      getContentChannelId(
        createItem({ channelId: "explicit", id: "1", title: "Programme" }),
      ),
    ).toBe("explicit");
    expect(
      getContentChannelId(
        createItem({
          channel: { id: "nested", name: "Channel" },
          id: "2",
          title: "Programme",
        }),
      ),
    ).toBe("nested");
    expect(
      getContentChannelId(
        createItem({ contentType: "channel", id: "channel", title: "Channel" }),
      ),
    ).toBe("channel");
  });

  it("resolves supported duration variants in priority order", () => {
    expect(
      getContentDurationSeconds(
        createItem({
          contentDurationSeconds: 20,
          durationSeconds: 10,
          id: "1",
          streamingDurationSeconds: 30,
          title: "Content",
        }),
      ),
    ).toBe(10);
  });

  it("classifies live and VOD items while excluding external-only content", () => {
    expect(
      getContentPlaybackType(
        createItem({ contentType: "channel", id: "live", title: "Live" }),
      ),
    ).toBe("live");
    expect(
      getContentPlaybackType(
        createItem({
          channelId: "channel",
          contentType: "episode",
          id: "programme",
          title: "Programme",
        }),
      ),
    ).toBe("live");
    expect(
      getContentPlaybackType(
        createItem({
          contentType: "linearStandalone",
          id: "linear",
          title: "Linear",
        }),
      ),
    ).toBe("live");
    expect(
      getContentPlaybackType(
        createItem({ contentType: "standalone", id: "vod", title: "VOD" }),
      ),
    ).toBe("vod");
    expect(
      getContentPlaybackType(
        createItem({ contentType: "VOD", id: "vod-2", title: "VOD" }),
      ),
    ).toBe("vod");
    expect(
      getContentPlaybackType(
        createItem({
          contentType: "standalone",
          externalViewingOptions: { externalOnly: true },
          id: "external",
          title: "External",
        }),
      ),
    ).toBeUndefined();
  });

  it("does not classify episodes without a channel id as directly playable", () => {
    expect(
      getContentPlaybackType(
        createItem({
          contentType: "episode",
          id: "unresolved-programme",
          title: "Programme",
        }),
      ),
    ).toBeUndefined();
  });
});

describe("getSeriesShowId", () => {
  it("uses a show's plain show id when present, else its id", () => {
    expect(
      getSeriesShowId(
        createItem({ contentType: "show", id: "s1", title: "S" }),
      ),
    ).toBe("s1");
    expect(
      getSeriesShowId(
        createItem({
          contentType: "show",
          id: "s1~vod",
          showId: "s1",
          title: "S",
        }),
      ),
    ).toBe("s1");
  });

  it("sends a season or VOD episode to its show", () => {
    expect(
      getSeriesShowId(
        createItem({
          contentType: "season",
          id: "season-1",
          showId: "s1",
          title: "Season",
        }),
      ),
    ).toBe("s1");
    expect(
      getSeriesShowId(
        createItem({
          contentType: "episode",
          id: "e1",
          showId: "s1",
          title: "Episode",
        }),
      ),
    ).toBe("s1");
  });

  it("leaves live episodes, items without a show, and films alone", () => {
    expect(
      getSeriesShowId(
        createItem({
          channelId: "channel-1",
          contentType: "episode",
          id: "e1",
          showId: "s1",
          title: "Live episode",
        }),
      ),
    ).toBeUndefined();
    expect(
      getSeriesShowId(
        createItem({ contentType: "episode", id: "e2", title: "No show" }),
      ),
    ).toBeUndefined();
    expect(
      getSeriesShowId(
        createItem({ contentType: "standalone", id: "f1", title: "Film" }),
      ),
    ).toBeUndefined();
  });
});

describe("handleRailItemPress", () => {
  const vodItem = createItem({
    contentType: "standalone",
    id: "short",
    title: "Short",
  });

  it.each([
    ContentCategoryTemplate.NINE_BY_SIXTEEN_STANDARD,
    ContentCategoryTemplate.NINE_BY_SIXTEEN_LARGE,
  ])("plays VOD from %s directly", (template) => {
    const onDirectVod = jest.fn();
    const onItem = jest.fn();

    handleRailItemPress({ template }, vodItem, { onDirectVod, onItem });

    expect(onDirectVod).toHaveBeenCalledWith(vodItem);
    expect(onItem).not.toHaveBeenCalled();
  });

  it("delegates normal VOD rails to the existing item flow", () => {
    const onDirectVod = jest.fn();
    const onItem = jest.fn();

    handleRailItemPress(
      { template: ContentCategoryTemplate.SIXTEEN_BY_NINE_STANDARD },
      vodItem,
      { onDirectVod, onItem },
    );

    expect(onItem).toHaveBeenCalledWith(vodItem);
    expect(onDirectVod).not.toHaveBeenCalled();
  });
});
