import {
  ContentCategoryTemplate,
  type ContentRail as RailPlacement,
} from "@bfbs/common-sdk";
import { fireEvent, render } from "@testing-library/react-native";

import {
  ContentRail,
  ContentTile,
  DEFAULT_RAIL_ITEM_LIMIT,
  getDisplayedTiles,
  getRailItemLimit,
  getTileWidth,
  isRankedRail,
  type RailTile,
  shouldShowViewAll,
} from "@/features/content-rails";
import { getRenderableContentItems } from "@/features/content-rails/utils/rail-content";

const TILE: RailTile = {
  contentType: "vod",
  id: "tile-1",
  media: [{ mimeType: "image/jpeg", url: "https://example.com/tile-1.jpg" }],
  title: "Frasier",
};

function buildRail(itemCount: number): RailPlacement {
  return createRail({
    category: createCategory({ id: "vod-rail", name: "Popular Films" }),
    items: Array.from({ length: itemCount }, (_, index) => ({
      contentType: "vod",
      id: `tile-${index + 1}`,
      title: `Tile ${index + 1}`,
    })),
  });
}

function buildContinueWatchingRail(itemCount: number): RailPlacement {
  return {
    ...buildRail(itemCount),
    category: createCategory({ id: "Continue", name: "Continue Watching" }),
  };
}

import { createCategory, createRail } from "../../__fixtures__/content";

describe("<ContentTile />", () => {
  test("renders the programme title and handles press", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ContentTile onPress={onPress} tile={TILE} width={168} />,
    );

    fireEvent.press(getByText("Frasier"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("shows watch progress and says it to screen readers", () => {
    const { getByLabelText, getByTestId } = render(
      <ContentTile progress={0.4} tile={TILE} width={168} />,
    );

    expect(getByTestId("content-tile-progress")).toBeTruthy();
    expect(getByLabelText("Frasier").props.accessibilityValue).toMatchObject({
      text: "40% watched",
    });
  });

  test("shows no progress without a value", () => {
    const { getByLabelText, queryByTestId } = render(
      <ContentTile tile={TILE} width={168} />,
    );

    expect(queryByTestId("content-tile-progress")).toBeNull();
    expect(
      getByLabelText("Frasier").props.accessibilityValue?.text,
    ).toBeUndefined();
  });
});

describe("<ContentRail />", () => {
  const rail: RailPlacement = {
    category: { id: "vod-manual", name: "Box Sets", type: "swimlane" },
    items: [
      { contentType: "vod", id: "tile-1", title: "The Long Patrol" },
      { contentType: "vod", id: "tile-2", title: "Frontline" },
    ],
    template: ContentCategoryTemplate.SIXTEEN_BY_NINE_LARGE,
  };

  test("renders the rail title and every tile", () => {
    const { getByText } = render(
      <ContentRail isTablet={false} onTilePress={jest.fn()} rail={rail} />,
    );

    getByText("Box Sets");
    getByText("The Long Patrol");
    getByText("Frontline");
  });

  test("passes the rail and tile to onTilePress", () => {
    const onTilePress = jest.fn();
    const { getByText } = render(
      <ContentRail isTablet={false} onTilePress={onTilePress} rail={rail} />,
    );

    fireEvent.press(getByText("Frontline"));

    expect(onTilePress).toHaveBeenCalledWith(rail, rail.items?.[1]);
  });

  test("renders category-navigation items", () => {
    const genreRail = createRail({
      category: createCategory({ id: "genres", name: "Genres" }),
      items: [
        {
          categoryId: "films",
          contentType: "category",
          id: "films",
          media: [
            { mimeType: "image/jpeg", url: "https://images.test/films.jpg" },
          ],
          title: "Films",
        },
      ],
      template: ContentCategoryTemplate.SQUARE_LARGE,
    });
    const { getByText } = render(
      <ContentRail isTablet={false} rail={genreRail} />,
    );

    expect(getByText("Films")).toBeTruthy();
  });

  test("shows the shared fallback for category destinations without artwork", () => {
    const genreRail = createRail({
      category: createCategory({ id: "genres", name: "Genres" }),
      items: [
        {
          categoryId: "films",
          contentType: "category",
          id: "films",
          title: "Films",
        },
      ],
      template: ContentCategoryTemplate.SQUARE_LARGE,
    });

    const { getByText, getByTestId } = render(
      <ContentRail isTablet={false} rail={genreRail} />,
    );

    expect(getByText("Films")).toBeTruthy();
    expect(getByTestId("programme-artwork-fallback")).toBeTruthy();
  });

  test("shows saved progress on Continue Watching tiles only", () => {
    const items = [
      {
        contentType: "vod",
        durationSeconds: 100,
        id: "tile-1",
        lastPlayPositionSeconds: 40,
        title: "Anna",
      },
    ];
    const continueWatching = { ...buildContinueWatchingRail(0), items };
    const otherRail = { ...buildRail(0), items };

    expect(
      render(
        <ContentRail isTablet={false} rail={continueWatching} />,
      ).getAllByTestId("content-tile-progress"),
    ).toHaveLength(1);
    expect(
      render(<ContentRail isTablet={false} rail={otherRail} />).queryByTestId(
        "content-tile-progress",
      ),
    ).toBeNull();
  });

  test("keeps a Continue Watching episode with a channel as a VOD tile", () => {
    const continueWatching = {
      ...buildContinueWatchingRail(0),
      items: [
        {
          channelId: "channel-1",
          contentType: "episode",
          durationSeconds: 100,
          id: "episode-1",
          lastPlayPositionSeconds: 40,
          title: "Derry Girls",
        },
      ],
    };
    const { getByTestId, queryByText } = render(
      <ContentRail isTablet={false} rail={continueWatching} />,
    );

    expect(getByTestId("content-tile-progress")).toBeTruthy();
    expect(queryByText("LIVE")).toBeNull();
  });
});

describe("provider rail rules", () => {
  test("keeps only playable VOD items in a vertical rail", () => {
    const rail: RailPlacement = {
      category: { id: "shorts", name: "Shorts", type: "swimlane" },
      items: [
        { contentType: "standalone", id: "playable", title: "Playable" },
        { contentType: "show", id: "show", title: "Show" },
        {
          contentType: "standalone",
          externalViewingOptions: { externalOnly: true },
          id: "external",
          title: "External",
        },
      ],
      template: ContentCategoryTemplate.NINE_BY_SIXTEEN_STANDARD,
    };

    expect(getDisplayedTiles(rail).map(({ id }) => id)).toEqual(["playable"]);
  });

  test("applies the rail limit after filtering vertical items", () => {
    const playableItems = Array.from(
      { length: DEFAULT_RAIL_ITEM_LIMIT },
      (_, index) => ({
        contentType: "standalone",
        id: `playable-${index}`,
        title: `Playable ${index}`,
      }),
    );
    const rail: RailPlacement = {
      category: { id: "shorts", name: "Shorts", type: "swimlane" },
      items: [
        { contentType: "show", id: "show", title: "Show" },
        ...playableItems,
      ],
      template: ContentCategoryTemplate.NINE_BY_SIXTEEN_STANDARD,
    };

    expect(getDisplayedTiles(rail)).toEqual(playableItems);
  });

  test("does not offer View All for filtered items already loaded", () => {
    const rail: RailPlacement = {
      category: { id: "shorts", name: "Shorts", type: "swimlane" },
      items: [
        { contentType: "standalone", id: "playable", title: "Playable" },
        { contentType: "show", id: "show", title: "Show" },
      ],
      metadata: { count: 2, total: 2 },
      template: ContentCategoryTemplate.NINE_BY_SIXTEEN_STANDARD,
    };

    expect(shouldShowViewAll(rail)).toBe(false);
  });

  test("offers View All when the provider reports unloaded vertical items", () => {
    const rail: RailPlacement = {
      category: { id: "shorts", name: "Shorts", type: "swimlane" },
      items: [
        { contentType: "standalone", id: "playable", title: "Playable" },
        { contentType: "show", id: "show", title: "Show" },
      ],
      metadata: { count: 2, total: 3 },
      template: ContentCategoryTemplate.NINE_BY_SIXTEEN_STANDARD,
    };

    expect(shouldShowViewAll(rail)).toBe(true);
  });

  test("preserves non-playable items outside vertical rails", () => {
    const items = [{ contentType: "show", id: "show", title: "Show" }];

    expect(
      getRenderableContentItems(
        { template: ContentCategoryTemplate.SQUARE_LARGE },
        items,
      ),
    ).toEqual(items);
  });

  test("shows as many tiles as the provider asked for", () => {
    const topTen: RailPlacement = {
      ...buildRail(DEFAULT_RAIL_ITEM_LIMIT + 5),
      contentDisplay: { maxItems: 10 },
    };

    expect(getRailItemLimit(topTen)).toBe(10);
    expect(getDisplayedTiles(topTen)).toHaveLength(10);
  });

  test("falls back to the BFBS default for an unusable maximum", () => {
    const rail = buildRail(DEFAULT_RAIL_ITEM_LIMIT + 5);

    expect(getRailItemLimit(rail)).toBe(DEFAULT_RAIL_ITEM_LIMIT);
    expect(getRailItemLimit({ ...rail, contentDisplay: { maxItems: 0 } })).toBe(
      DEFAULT_RAIL_ITEM_LIMIT,
    );
    expect(
      getRailItemLimit({ ...rail, contentDisplay: { maxItems: -3 } }),
    ).toBe(DEFAULT_RAIL_ITEM_LIMIT);
  });

  test("keeps View All off a rail the provider turned it off for", () => {
    const rail = buildRail(DEFAULT_RAIL_ITEM_LIMIT + 5);

    expect(shouldShowViewAll(rail)).toBe(true);
    expect(
      shouldShowViewAll({ ...rail, display: { seeAllPosition: "none" } }),
    ).toBe(false);
    expect(
      shouldShowViewAll({ ...rail, display: { seeAllPosition: "end" } }),
    ).toBe(true);
  });

  test("offers View All against the tiles the rail actually shows", () => {
    const topTen: RailPlacement = {
      ...buildRail(12),
      contentDisplay: { maxItems: 10 },
      metadata: { count: 12, total: 12 },
    };

    expect(shouldShowViewAll(topTen)).toBe(true);
  });

  test("keeps a category-navigation list complete and does not offer View All", () => {
    const items = Array.from(
      { length: DEFAULT_RAIL_ITEM_LIMIT + 5 },
      (_, index) => ({
        categoryId: `genre-${index + 1}`,
        contentType: "category",
        id: `genre-${index + 1}`,
        title: `Genre ${index + 1}`,
      }),
    );
    const navigationRail = createRail({
      category: createCategory({ id: "genres", name: "Genres" }),
      contentDisplay: { maxItems: 4 },
      items,
      metadata: { count: items.length, total: items.length },
      template: ContentCategoryTemplate.SQUARE_SMALL,
    });

    expect(getDisplayedTiles(navigationRail)).toEqual(items);
    expect(shouldShowViewAll(navigationRail)).toBe(false);
  });

  test("shows up to 30 Continue Watching tiles, whatever the provider asks for", () => {
    const continueWatching: RailPlacement = {
      ...buildContinueWatchingRail(35),
      contentDisplay: { maxItems: 15 },
    };

    expect(getRailItemLimit(continueWatching)).toBe(30);
    expect(getDisplayedTiles(continueWatching)).toHaveLength(30);
  });

  test("reads the provider's designed rails as its Top 10 rails", () => {
    expect(isRankedRail(buildRail(3))).toBe(false);
    expect(
      isRankedRail({
        ...buildRail(3),
        template: ContentCategoryTemplate.SIXTEEN_BY_NINE_DESIGNED_SMALL,
      }),
    ).toBe(true);
    expect(
      isRankedRail({
        ...buildRail(3),
        template: ContentCategoryTemplate.SIXTEEN_BY_NINE_DESIGNED_LARGE,
      }),
    ).toBe(true);
  });

  test("numbers a designed rail from one", () => {
    const topTen: RailPlacement = {
      ...buildRail(10),
      contentDisplay: { maxItems: 10 },
      template: ContentCategoryTemplate.SIXTEEN_BY_NINE_DESIGNED_SMALL,
    };

    const { getAllByTestId } = render(
      <ContentRail isTablet={false} rail={topTen} />,
    );

    expect(getAllByTestId("content-tile-rank").length).toBeGreaterThan(0);
  });
});

describe("View All", () => {
  test("shouldShowViewAll and getDisplayedTiles cap at the threshold", () => {
    const over = buildRail(DEFAULT_RAIL_ITEM_LIMIT + 5);
    const under = buildRail(DEFAULT_RAIL_ITEM_LIMIT);

    expect(shouldShowViewAll(over)).toBe(true);
    expect(shouldShowViewAll(under)).toBe(false);
    expect(getDisplayedTiles(over)).toHaveLength(DEFAULT_RAIL_ITEM_LIMIT);
    expect(getDisplayedTiles(under)).toHaveLength(DEFAULT_RAIL_ITEM_LIMIT);
  });

  test("uses the provider's total, so a capped page still offers View All", () => {
    const rail = buildRail(DEFAULT_RAIL_ITEM_LIMIT);
    const cappedPage: RailPlacement = {
      ...rail,
      metadata: {
        count: DEFAULT_RAIL_ITEM_LIMIT,
        total: DEFAULT_RAIL_ITEM_LIMIT + 40,
      },
    };

    expect(shouldShowViewAll(cappedPage)).toBe(true);
    expect(getDisplayedTiles(cappedPage)).toHaveLength(DEFAULT_RAIL_ITEM_LIMIT);
    expect(
      shouldShowViewAll({
        ...rail,
        metadata: {
          count: DEFAULT_RAIL_ITEM_LIMIT,
          total: DEFAULT_RAIL_ITEM_LIMIT,
        },
      }),
    ).toBe(false);
  });

  test("never trusts a total smaller than the page the provider sent", () => {
    const rail = buildRail(DEFAULT_RAIL_ITEM_LIMIT + 1);

    expect(
      shouldShowViewAll({ ...rail, metadata: { count: 0, total: 0 } }),
    ).toBe(true);
    expect(
      getDisplayedTiles({ ...rail, metadata: { count: 0, total: 0 } }),
    ).toHaveLength(DEFAULT_RAIL_ITEM_LIMIT);
  });

  test("renders a View All tile and caps content tiles when over the threshold", () => {
    const { getByLabelText, queryByText } = render(
      <ContentRail
        isTablet={false}
        rail={buildRail(DEFAULT_RAIL_ITEM_LIMIT + 1)}
      />,
    );

    getByLabelText("View All");
    expect(queryByText("Tile 16")).toBeNull();
  });

  test("does not render a View All tile at or below the threshold", () => {
    const { queryByLabelText } = render(
      <ContentRail
        isTablet={false}
        rail={buildRail(DEFAULT_RAIL_ITEM_LIMIT)}
      />,
    );

    expect(queryByLabelText("View All")).toBeNull();
  });

  test("calls onViewAllPress with the rail when the View All tile is pressed", () => {
    const onViewAllPress = jest.fn();
    const rail = buildRail(DEFAULT_RAIL_ITEM_LIMIT + 1);
    const { getByLabelText } = render(
      <ContentRail
        isTablet={false}
        onViewAllPress={onViewAllPress}
        rail={rail}
      />,
    );

    fireEvent.press(getByLabelText("View All"));

    expect(onViewAllPress).toHaveBeenCalledWith(rail);
  });

  test("never offers View All on Continue Watching, even when the provider has more", () => {
    const continueWatching: RailPlacement = {
      ...buildContinueWatchingRail(35),
      metadata: { count: 35, total: 100 },
    };

    expect(shouldShowViewAll(continueWatching)).toBe(false);
    expect(
      render(
        <ContentRail isTablet={false} rail={continueWatching} />,
      ).queryByLabelText("View All"),
    ).toBeNull();
  });
});

describe("getTileWidth", () => {
  test("returns phone widths by default", () => {
    expect(getTileWidth({ isTablet: false, size: "large" })).toBe(255);
    expect(getTileWidth({ isTablet: false, size: "standard" })).toBe(168);
  });

  test("returns tablet portrait widths", () => {
    expect(
      getTileWidth({ isLandscape: false, isTablet: true, size: "large" }),
    ).toBe(268);
    expect(
      getTileWidth({ isLandscape: false, isTablet: true, size: "standard" }),
    ).toBe(173);
  });

  test("returns tablet landscape widths", () => {
    expect(
      getTileWidth({ isLandscape: true, isTablet: true, size: "large" }),
    ).toBe(333);
    expect(
      getTileWidth({ isLandscape: true, isTablet: true, size: "standard" }),
    ).toBe(263);
  });
});
