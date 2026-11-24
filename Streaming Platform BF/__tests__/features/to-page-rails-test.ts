import type {
  ContentDisplayOptions,
  ContentItem,
  ContentRail,
} from "@bfbs/common-sdk";
import type { LiveChannel } from "@/features/live-channels";

jest.mock("@bfbs/common-sdk", () => ({
  ContentCategoryTemplate: {
    HERO: "HERO",
    NINE_BY_SIXTEEN_LARGE: "NINE_BY_SIXTEEN_LARGE",
    NINE_BY_SIXTEEN_STANDARD: "NINE_BY_SIXTEEN_STANDARD",
    SIXTEEN_BY_NINE_DESIGNED_LARGE: "SIXTEEN_BY_NINE_DESIGNED_LARGE",
    SIXTEEN_BY_NINE_DESIGNED_SMALL: "SIXTEEN_BY_NINE_DESIGNED_SMALL",
    SIXTEEN_BY_NINE_LARGE: "SIXTEEN_BY_NINE_LARGE",
    SIXTEEN_BY_NINE_STANDARD: "SIXTEEN_BY_NINE_STANDARD",
    SQUARE_LARGE: "SQUARE_LARGE",
    SQUARE_SMALL: "SQUARE_SMALL",
  },
  ContentThumbnailDisplay: {
    CHANNEL_LOGO: "CHANNEL_LOGO",
    CHANNEL_LOGO_INVERTED: "CHANNEL_LOGO_INVERTED",
    CHANNEL_POSTER: "CHANNEL_POSTER",
    EVENT_POSTER: "EVENT_POSTER",
    EVENT_POSTER_WITH_TITLE: "EVENT_POSTER_WITH_TITLE",
  },
  isCategoryNavigationItem: (item: ContentItem) =>
    item.contentType === "category" && typeof item.categoryId === "string",
}));

const {
  ContentCategoryTemplate,
  ContentThumbnailDisplay,
} = require("@bfbs/common-sdk");
const { toPageRails } =
  require("@/features/content-rails/utils/to-page-rails") as typeof import("@/features/content-rails/utils/to-page-rails");

import {
  createCategory,
  createRail as createRailFixture,
} from "../../__fixtures__/content";

const createRail = ({
  contentDisplay,
  id,
  items = [],
  name = "Rail",
  template = ContentCategoryTemplate.SIXTEEN_BY_NINE_STANDARD,
}: {
  contentDisplay?: ContentDisplayOptions;
  id: string;
  items?: ContentItem[];
  name?: string;
  template?: ContentRail["template"];
}): ContentRail =>
  createRailFixture({
    category: createCategory({ id, name }),
    ...(contentDisplay ? { contentDisplay } : {}),
    items,
    template,
  });

const createItem = (overrides: Partial<ContentItem>): ContentItem => ({
  id: "item-1",
  title: "Item",
  ...overrides,
});

const createSquareRail = (
  overrides: Parameters<typeof createRail>[0],
): ContentRail =>
  createRail({
    ...overrides,
    name: overrides.name ?? "Channels",
    template: overrides.template ?? ContentCategoryTemplate.SQUARE_LARGE,
  });

const channelOne: LiveChannel = {
  currentProgramme: { id: "programme-1", title: "Now" },
  id: "channel-1",
  name: "Channel One",
};
const loaded = { channels: [channelOne], error: null, isLoading: false };

describe("toPageRails", () => {
  it("maps an on-demand rail to a VOD rail", () => {
    const vodRail = createRail({
      id: "vod-rail",
      items: [createItem({ contentType: "standalone" })],
      name: "VOD",
    });

    expect(toPageRails([vodRail], loaded)).toEqual([
      { id: "vod-rail", kind: "content", placement: vodRail },
    ]);
  });

  it("keeps a square category-navigation rail on the content-tile path", () => {
    const categoryRail = createSquareRail({
      id: "home-genres",
      items: [
        createItem({
          categoryId: "sport",
          contentType: "category",
          id: "sport",
          title: "Sport",
        }),
      ],
      name: "Genres",
    });

    expect(toPageRails([categoryRail], loaded)).toEqual([
      {
        id: "home-genres",
        kind: "category-navigation",
        placement: categoryRail,
      },
    ]);
  });

  it("keeps a landscape category-navigation rail on the content-tile path", () => {
    const categoryRail = createRail({
      id: "vod-channels",
      items: [
        createItem({
          categoryId: "BBC_One_Shop",
          contentType: "category",
          id: "BBC_One_Shop",
          title: "BBC One",
        }),
      ],
      name: "Channels VOD",
    });

    expect(toPageRails([categoryRail], loaded)).toEqual([
      {
        id: "vod-channels",
        kind: "category-navigation",
        placement: categoryRail,
      },
    ]);
  });

  it("keeps hero template rails as a Hero", () => {
    const heroRail = createRail({
      id: "hero-rail",
      items: [createItem({ contentType: "standalone" })],
      name: "Hero",
      template: ContentCategoryTemplate.HERO,
    });

    expect(toPageRails([heroRail], loaded)).toEqual([
      { id: "hero-rail", kind: "hero", liveChannels: {}, placement: heroRail },
    ]);
  });

  it("drops an empty Hero rail, so the page has no gap", () => {
    const heroRail = createRail({
      id: "hero-rail",
      items: [],
      name: "Hero",
      template: ContentCategoryTemplate.HERO,
    });

    expect(toPageRails([heroRail], loaded)).toEqual([]);
  });

  it("maps a GO placeholder with images to a promo banner, ahead of the Hero rule", () => {
    const promoRail: ContentRail = {
      category: createCategory({
        id: "promo-rail",
        media: [
          {
            height: 150,
            mimeType: "image/png",
            url: "https://images.test/promo.png",
            width: 343,
          },
        ],
        name: "Promo Banner",
        type: "placeholder",
      }),
      template: ContentCategoryTemplate.HERO,
    };

    expect(toPageRails([promoRail], loaded)).toEqual([
      { id: "promo-rail", kind: "promo", placement: promoRail },
    ]);
  });

  it("treats rails named like page heroes as a Hero", () => {
    const heroRails = [
      createRail({
        id: "FeaturedHome",
        items: [createItem({ contentType: "standalone" })],
        name: "FeaturedHome",
      }),
      createRail({
        id: "sport-hero",
        items: [createItem({ contentType: "standalone" })],
        name: "Sport Hero",
      }),
      createRail({
        id: "FeaturedVOD",
        items: [createItem({ contentType: "standalone" })],
        name: "FeaturedVOD",
      }),
      createRail({
        id: "featured-live-tv",
        items: [createItem({ contentType: "channel", id: "channel-1" })],
        name: "Featured Live TV",
      }),
      createRail({
        id: "moreHero",
        items: [createItem({ contentType: "standalone" })],
        name: "MoreHero",
      }),
    ];

    expect(toPageRails(heroRails, loaded)).toEqual(
      heroRails.map((rail) => ({
        id: rail.category.id,
        kind: "hero",
        liveChannels:
          rail.category.id === "featured-live-tv"
            ? { "channel-1": channelOne }
            : {},
        placement: rail,
      })),
    );
  });

  it("counts a Hero event as live only while the guide has it on now", () => {
    const heroRail = createRail({
      id: "HomeHero",
      items: [
        createItem({
          channelId: "channel-1",
          contentType: "episode",
          id: "programme-1",
        }),
        createItem({
          channelId: "channel-1",
          contentType: "episode",
          id: "programme-2",
        }),
      ],
      template: ContentCategoryTemplate.HERO,
    });

    expect(toPageRails([heroRail], loaded)).toEqual([
      {
        id: "HomeHero",
        kind: "hero",
        liveChannels: { "programme-1": channelOne },
        placement: heroRail,
      },
    ]);
  });

  it("keeps generic featured rails that are not page heroes", () => {
    const featuredRail = createRail({
      id: "featured",
      items: [createItem({ contentType: "standalone" })],
      name: "Featured",
    });

    expect(toPageRails([featuredRail], loaded)).toEqual([
      { id: "featured", kind: "content", placement: featuredRail },
    ]);
  });

  it("maps a rail of programmes to a live-channels rail with resolved channels", () => {
    const liveRail = createRail({
      id: "live-rail",
      items: [
        createItem({
          channelId: "channel-1",
          contentType: "episode",
          id: "programme-1",
        }),
      ],
      name: "Live",
      template: ContentCategoryTemplate.SIXTEEN_BY_NINE_LARGE,
    });

    const [rail] = toPageRails([liveRail], loaded);

    expect(rail?.kind).toBe("live-channels");

    if (rail?.kind === "live-channels") {
      expect(rail.channels.map((channel) => channel.id)).toEqual(["channel-1"]);
      expect(rail.title).toBe("Live");
      expect(rail.presentation).toEqual({
        size: "large",
        variant: "landscape",
      });
    }
  });

  it("keeps Continue Watching on the content path, even for episodes with a channel", () => {
    const continueWatchingRail = createRail({
      id: "Continue",
      items: [
        createItem({
          channelId: "channel-1",
          contentType: "episode",
          id: "programme-1",
        }),
      ],
      name: "Continue Watching",
    });

    expect(toPageRails([continueWatchingRail], loaded)).toEqual([
      { id: "Continue", kind: "content", placement: continueWatchingRail },
    ]);
  });

  it("builds square tiles from the rail's own items and image variant", () => {
    const squareRail = createSquareRail({
      contentDisplay: {
        thumbnailDisplay: ContentThumbnailDisplay.CHANNEL_POSTER,
      },
      id: "square-rail",
      items: [
        createItem({
          contentType: "channel",
          id: "channel-1",
          media: [
            {
              mimeType: "image/png",
              type: "regular",
              url: "https://img/logo.png",
            },
            {
              mimeType: "image/png",
              type: "poster",
              url: "https://img/poster.png",
            },
          ],
          title: "Channel One",
        }),
      ],
    });

    const [rail] = toPageRails([squareRail], loaded);

    expect(rail?.kind).toBe("channels");

    if (rail?.kind === "channels") {
      expect(rail.presentation).toEqual({
        size: "large",
        variant: "squareCard",
      });
      expect(rail.tiles).toEqual([
        {
          channel: channelOne,
          id: "channel-1",
          media: {
            contentFit: "cover",
            url: "https://img/poster.png",
          },
          name: "Channel One",
        },
      ]);
    }
  });

  it("uses later-loaded channel media when the rail item has no image", () => {
    const squareRail = createSquareRail({
      contentDisplay: {
        thumbnailDisplay: ContentThumbnailDisplay.CHANNEL_LOGO_INVERTED,
      },
      id: "square-rail",
      items: [
        createItem({
          contentType: "channel",
          id: "channel-1",
          media: [
            {
              mimeType: "image/png",
              type: "inverted",
              url: "https://img/inverted.png",
            },
          ],
        }),
        createItem({ contentType: "channel", id: "channel-2", media: [] }),
      ],
    });
    const secondChannel: LiveChannel = {
      id: "channel-2",
      media: [
        {
          mimeType: "image/png",
          type: "inverted",
          url: "https://img/channel-2-inverted.png",
        },
      ],
      name: "Channel Two",
    };

    const [rail] = toPageRails([squareRail], {
      channels: [channelOne, secondChannel],
      error: null,
      isLoading: false,
    });

    expect(rail?.kind).toBe("channels");

    if (rail?.kind === "channels") {
      expect(rail.tiles.map((tile) => tile.media?.url)).toEqual([
        "https://img/inverted.png",
        "https://img/channel-2-inverted.png",
      ]);
    }
  });

  it("does not substitute another image when the requested variant is missing", () => {
    const squareRail = createSquareRail({
      contentDisplay: {
        thumbnailDisplay: ContentThumbnailDisplay.CHANNEL_POSTER,
      },
      id: "square-rail",
      items: [
        createItem({
          contentType: "channel",
          id: "channel-1",
          media: [
            {
              mimeType: "image/png",
              type: "regular",
              url: "https://img/logo.png",
            },
          ],
        }),
      ],
    });

    const [rail] = toPageRails([squareRail], loaded);

    expect(rail?.kind).toBe("channels");

    if (rail?.kind === "channels") {
      expect(rail.tiles).toEqual([
        {
          channel: channelOne,
          id: "channel-1",
          name: "Item",
        },
      ]);
    }
  });

  it("uses supplied media when the provider names no image variant", () => {
    const squareRail = createSquareRail({
      id: "square-rail",
      items: [
        createItem({
          contentType: "channel",
          id: "channel-1",
          media: [
            {
              mimeType: "image/png",
              type: "poster",
              url: "https://img/poster.png",
            },
          ],
        }),
      ],
    });

    const [rail] = toPageRails([squareRail], loaded);

    expect(rail?.kind).toBe("channels");

    if (rail?.kind === "channels") {
      expect(rail.tiles).toEqual([
        {
          channel: channelOne,
          id: "channel-1",
          media: {
            contentFit: "cover",
            url: "https://img/poster.png",
          },
          name: "Item",
        },
      ]);
    }
  });

  it("keeps a square on-demand rail on the content-tile path", () => {
    const squareVodRail = createSquareRail({
      id: "square-vod-rail",
      items: [createItem({ contentType: "standalone", id: "vod-1" })],
    });

    expect(toPageRails([squareVodRail], loaded)).toEqual([
      {
        id: "square-vod-rail",
        kind: "content",
        placement: squareVodRail,
      },
    ]);
  });

  it("keeps mixed square content on the content-tile path", () => {
    const squareVodRail = createSquareRail({
      contentDisplay: {
        thumbnailDisplay: ContentThumbnailDisplay.CHANNEL_POSTER,
      },
      id: "square-vod-rail",
      items: [
        createItem({
          contentType: "channel",
          id: "channel-1",
          media: [
            {
              mimeType: "image/png",
              type: "poster",
              url: "https://img/poster.png",
            },
          ],
        }),
        createItem({ contentType: "standalone", id: "vod-1" }),
      ],
    });

    expect(toPageRails([squareVodRail], loaded)).toEqual([
      {
        id: "square-vod-rail",
        kind: "content",
        placement: squareVodRail,
      },
    ]);
  });

  it("preserves a landscape rail of channels as channel tiles", () => {
    const channelsRail = createRail({
      id: "Channels",
      items: [createItem({ contentType: "channel", id: "channel-1" })],
      name: "Channels",
      template: ContentCategoryTemplate.SIXTEEN_BY_NINE_STANDARD,
    });

    const [rail] = toPageRails([channelsRail], loaded);

    expect(rail?.kind).toBe("channels");

    if (rail?.kind === "channels") {
      expect(rail.tiles.map(({ channel }) => channel.id)).toEqual([
        "channel-1",
      ]);
      expect(rail.presentation.variant).toBe("landscape");
    }
  });

  it("keeps a rail of programmes playing on tap", () => {
    const programmeRail = createRail({
      id: "OnNow",
      items: [
        createItem({
          channelId: "channel-1",
          contentType: "episode",
          id: "programme-1",
        }),
      ],
      name: "Live Events",
    });

    const [rail] = toPageRails([programmeRail], loaded);

    expect(rail?.kind).toBe("live-channels");
  });

  it("keeps a channel rail when live data does not contain the channel", () => {
    const channelsRail = createRail({
      id: "live-rail",
      items: [createItem({ contentType: "channel", id: "missing" })],
      name: "Live",
    });

    const [rail] = toPageRails([channelsRail], loaded);

    expect(rail?.kind).toBe("channels");
    if (rail?.kind === "channels") {
      expect(rail.tiles[0]?.channel).toEqual({ id: "missing", name: "Item" });
    }
  });

  it("keeps a channel-less episode on the VOD content path", () => {
    const episodeRail = createRail({
      id: "programme-rail",
      items: [createItem({ contentType: "episode", id: "programme-1" })],
      name: "Programmes",
    });

    const [rail] = toPageRails([episodeRail], loaded);

    expect(rail?.kind).toBe("content");
  });

  it("keeps an on-demand episode even when no live channel airs it", () => {
    const episodeRail = createRail({
      id: "programme-rail",
      items: [createItem({ contentType: "episode", id: "missing-programme" })],
      name: "Programmes",
    });

    expect(toPageRails([episodeRail], loaded)).toEqual([
      { id: "programme-rail", kind: "content", placement: episodeRail },
    ]);
  });

  it("keeps a rail of channels while they are still loading", () => {
    const channelsRail = createRail({
      id: "Channels",
      items: [createItem({ contentType: "channel", id: "channel-1" })],
      name: "Channels",
    });

    const rails = toPageRails([channelsRail], {
      channels: [],
      error: null,
      isLoading: true,
    });

    expect(rails).toHaveLength(1);
    expect(rails[0]?.kind).toBe("channels");
  });

  it("keeps a channel-less episode rail on the content path while loading", () => {
    const episodeRail = createRail({
      id: "live-rail",
      items: [createItem({ contentType: "episode", id: "programme-1" })],
      name: "Live",
    });

    const rails = toPageRails([episodeRail], {
      channels: [],
      error: null,
      isLoading: true,
    });

    expect(rails).toHaveLength(1);
    expect(rails[0]?.kind).toBe("content");
  });

  it("drops a rail without playable items", () => {
    const emptyRail = createRail({
      id: "empty-rail",
      items: [createItem({ contentType: "group" })],
      name: "Empty",
    });

    expect(toPageRails([emptyRail], loaded)).toEqual([]);
  });
});
