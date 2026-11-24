import type { ContentPage, ContentRail } from "@bfbs/common-sdk";

const mockGetNavigation = jest.fn();
const mockGetPage = jest.fn();
const mockGetCollectionContent = jest.fn();
const mockGetAllChannels = jest.fn();
const mockGetProgrammeGuide = jest.fn();
const mockReportError = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  ContentCatalogue: {
    getAllChannels: mockGetAllChannels,
    getCollectionContent: mockGetCollectionContent,
    getNavigation: mockGetNavigation,
    getPage: mockGetPage,
    getProgrammeGuide: mockGetProgrammeGuide,
  },
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
}));

import {
  createCategory,
  createNavigation,
  createPage,
  createPageCategory,
  createRail,
} from "../../__fixtures__/content";

jest.mock("@/infra/error", () => ({
  reportError: mockReportError,
}));

const {
  ContentCategoryTemplate,
  ContentThumbnailDisplay,
} = require("@bfbs/common-sdk");
const {
  assertInitialHomeContentReady,
  fetchAppContent,
  getAppContentNavigationTitle,
  getAppContentRail,
  getAppContentSection,
  getInitialAppContentSection,
  getOnNowAppContentSection,
} =
  require("@/features/content-rails/app-content") as typeof import("@/features/content-rails/app-content");
const { DEFAULT_RAIL_ITEM_LIMIT } =
  require("@/features/content-rails/utils/rail-content") as typeof import("@/features/content-rails/utils/rail-content");

/** Every page the navigation offers, keyed by the id the app will ask for. */
const respondWithPages = (pages: Record<string, ContentPage>) => {
  mockGetPage.mockImplementation(({ categoryId }: { categoryId: string }) => {
    const page = pages[categoryId];

    return page
      ? Promise.resolve(page)
      : Promise.resolve(
          createPage(createCategory({ id: categoryId, name: categoryId })),
        );
  });
};

describe("fetchAppContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllChannels.mockResolvedValue([]);
    mockGetProgrammeGuide.mockResolvedValue({ channels: [], totalChannels: 0 });
  });

  it("maps the production navigation pages to generated routes", async () => {
    const homeCategory = createPageCategory({ id: "HOME", name: "Home" });
    const onNowCategory = createPageCategory({
      id: "OnNowTop",
      name: "On Now",
    });
    const vodCategory = createPageCategory({ id: "VOD", name: "TV & Film" });
    const homeRail = createRail({
      category: createCategory({ id: "home-rail", name: "Featured" }),
    });

    mockGetNavigation.mockResolvedValue(
      createNavigation([
        homeCategory,
        onNowCategory,
        createPageCategory({ id: "Sport", name: "Sport" }),
        vodCategory,
        createPageCategory({ id: "More", name: "More" }),
      ]),
    );
    respondWithPages({
      HOME: createPage(homeCategory, [homeRail]),
      More: createPage(createPageCategory({ id: "More", name: "More" })),
      OnNowTop: createPage(onNowCategory),
      Sport: createPage(createPageCategory({ id: "Sport", name: "Sport" })),
      VOD: createPage(vodCategory),
    });

    const appContent = await fetchAppContent();

    expect(appContent.navigation.children).toHaveLength(5);
    expect(appContent.sections.map((section) => section.route)).toEqual([
      "/",
      "/on-now",
      "/sport",
      "/tv-film",
      "/more",
    ]);
    expect(getInitialAppContentSection(appContent)?.pageCategory).toBe(
      homeCategory,
    );
    expect(getInitialAppContentSection(appContent)?.rails).toEqual([homeRail]);
    expect(getOnNowAppContentSection(appContent)?.pageCategory).toBe(
      onNowCategory,
    );
    expect(getAppContentSection(appContent, "/tv-film")?.pageCategory).toBe(
      vodCategory,
    );
    expect(getAppContentNavigationTitle(appContent, "/")).toBe("Home");
    expect(getAppContentNavigationTitle(appContent, "/on-now")).toBe("On Now");
  });

  it("takes each rail's presentation from the page that placed it", async () => {
    const homeCategory = createPageCategory({ id: "HOME", name: "Home" });
    const channelsRail = createRail({
      category: createCategory({ id: "channels", name: "Channels" }),
      contentDisplay: {
        maxItems: 15,
        thumbnailDisplay: ContentThumbnailDisplay.CHANNEL_POSTER,
      },
      items: [{ contentType: "channel", id: "channel-1", title: "BFBS SPORT" }],
      template: ContentCategoryTemplate.SQUARE_LARGE,
    });

    mockGetNavigation.mockResolvedValue(createNavigation([homeCategory]));
    respondWithPages({ HOME: createPage(homeCategory, [channelsRail]) });

    const appContent = await fetchAppContent();
    const [rail] = getInitialAppContentSection(appContent)?.rails ?? [];

    expect(rail?.category.id).toBe("channels");
    expect(rail?.template).toBe(ContentCategoryTemplate.SQUARE_LARGE);
    expect(rail?.contentDisplay).toEqual({
      maxItems: 15,
      thumbnailDisplay: ContentThumbnailDisplay.CHANNEL_POSTER,
    });
    expect(rail?.items).toEqual(channelsRail.items);
  });

  it("loads a page without asking for any rail's content", async () => {
    const homeCategory = createPageCategory({ id: "HOME", name: "Home" });

    mockGetNavigation.mockResolvedValue(createNavigation([homeCategory]));
    respondWithPages({
      HOME: createPage(homeCategory, [
        createRail({
          category: createCategory({ id: "movies", name: "Movies" }),
        }),
        createRail({
          category: createCategory({ id: "sport", name: "Sport" }),
        }),
      ]),
    });

    await fetchAppContent();

    expect(mockGetPage).toHaveBeenCalledTimes(1);
    expect(mockGetPage).toHaveBeenCalledWith({
      categoryId: "HOME",
      collectionLimit: DEFAULT_RAIL_ITEM_LIMIT + 1,
    });
    expect(mockGetCollectionContent).not.toHaveBeenCalled();
  });

  it("ignores non-content pages so they do not consume a route", async () => {
    const homeCategory = createPageCategory({ id: "HOME", name: "Home" });
    const onNowCategory = createPageCategory({
      id: "OnNowTop",
      name: "On Now",
    });

    mockGetNavigation.mockResolvedValue(
      createNavigation([
        createPageCategory({
          id: "Guide",
          name: "TV Guide",
          type: "guide_root",
        }),
        homeCategory,
        onNowCategory,
      ]),
    );
    respondWithPages({
      HOME: createPage(homeCategory),
      OnNowTop: createPage(onNowCategory),
    });

    const appContent = await fetchAppContent();

    expect(mockGetPage).not.toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "Guide" }),
    );
    expect(appContent.sections.map((section) => section.route)).toEqual([
      "/",
      "/on-now",
    ]);
    expect(getInitialAppContentSection(appContent)?.pageCategory).toBe(
      homeCategory,
    );
    expect(getOnNowAppContentSection(appContent)?.pageCategory).toBe(
      onNowCategory,
    );
  });

  it("loads every top-level SDK content page instead of a fixed count", async () => {
    const pageNames = [
      "Home",
      "On Now",
      "Sport",
      "TV & Film",
      "TV Guide",
      "More",
      "Forces News",
    ];

    mockGetNavigation.mockResolvedValue(
      createNavigation(
        pageNames.map((name) =>
          createPageCategory({ id: `${name}-page`, name }),
        ),
      ),
    );
    respondWithPages({});

    const appContent = await fetchAppContent();

    expect(mockGetPage).toHaveBeenCalledWith({
      categoryId: "Forces News-page",
      collectionLimit: DEFAULT_RAIL_ITEM_LIMIT + 1,
    });
    expect(appContent.sections.map((section) => section.route)).toEqual([
      "/",
      "/on-now",
      "/sport",
      "/tv-film",
      "/tv-guide",
      "/more",
      "/forces-news",
    ]);
  });

  it("maps Home and On Now routes by SDK identifiers when navigation order changes", async () => {
    mockGetNavigation.mockResolvedValue(
      createNavigation([
        createPageCategory({ id: "sport-page", name: "Sport" }),
        createPageCategory({ id: "Home", name: "Home" }),
        createPageCategory({ id: "LiveTV", name: "Live TV" }),
      ]),
    );
    respondWithPages({});

    const appContent = await fetchAppContent();

    expect(appContent.sections.map((section) => section.route)).toEqual([
      "/sport",
      "/",
      "/on-now",
    ]);
    expect(getInitialAppContentSection(appContent)?.pageCategory.id).toBe(
      "Home",
    );
    expect(getOnNowAppContentSection(appContent)?.pageCategory.id).toBe(
      "LiveTV",
    );
  });

  it("uses SDK IDs and suffixes when generated section slugs collide", async () => {
    mockGetNavigation.mockResolvedValue(
      createNavigation([
        createPageCategory({ id: "home-page", name: "Home" }),
        createPageCategory({ id: "live-page", name: "Live TV" }),
        createPageCategory({ id: "sport-page-1", name: "Sport" }),
        createPageCategory({ id: "sport-page-2", name: "Sport" }),
        createPageCategory({ id: "search", name: "Search" }),
        createPageCategory({ id: "search", name: "Search" }),
      ]),
    );
    respondWithPages({});

    const appContent = await fetchAppContent();

    expect(appContent.sections.map((section) => section.route)).toEqual([
      "/",
      "/on-now",
      "/sport",
      "/sport-page-2",
      "/section",
      "/section-2",
    ]);
  });

  it("resolves a live episode's channel from the programme guide", async () => {
    const homeCategory = createPageCategory({ id: "home-page", name: "Home" });
    const liveRail = createRail({
      category: createCategory({ id: "live-rail", name: "Live" }),
      items: [
        { contentType: "episode", id: "programme-1", title: "Live Event" },
      ],
    });

    mockGetNavigation.mockResolvedValue(createNavigation([homeCategory]));
    respondWithPages({ "home-page": createPage(homeCategory, [liveRail]) });
    mockGetAllChannels.mockResolvedValue([
      { id: "channel-1", name: "Channel One" },
    ]);
    mockGetProgrammeGuide.mockResolvedValue({
      channels: [
        {
          channelId: "channel-1",
          programmes: [
            { contentType: "episode", id: "programme-1", title: "Live Event" },
          ],
        },
      ],
      totalChannels: 1,
    });

    const appContent = await fetchAppContent();

    expect(getInitialAppContentSection(appContent)?.rails[0]?.items).toEqual([
      expect.objectContaining({ channelId: "channel-1", id: "programme-1" }),
    ]);
  });

  it("keeps loaded rails when programme guide enrichment fails", async () => {
    const homeCategory = createPageCategory({ id: "home-page", name: "Home" });
    const liveRail = createRail({
      category: createCategory({ id: "live-rail", name: "Live" }),
      items: [
        { contentType: "episode", id: "programme-1", title: "Live Event" },
      ],
    });

    mockGetNavigation.mockResolvedValue(createNavigation([homeCategory]));
    respondWithPages({ "home-page": createPage(homeCategory, [liveRail]) });
    const error = new Error("guide unavailable");
    mockGetAllChannels.mockRejectedValue(error);

    const appContent = await fetchAppContent();

    expect(getInitialAppContentSection(appContent)?.rails).toEqual([liveRail]);
    expect(mockReportError).toHaveBeenCalledWith(error, {
      tags: {
        area: "content_rails",
        operation: "programme_guide_enrichment",
      },
    });
  });

  it("quietly drops an unhydrated rail and keeps the page's order", async () => {
    const homeCategory = createPageCategory({ id: "home-page", name: "Home" });
    const newsRail = createRail({
      category: createCategory({ id: "news-rail", name: "News" }),
      items: [{ contentType: "standalone", id: "vod-1", title: "VOD" }],
    });
    const emptyRail = createRail({
      category: createCategory({ id: "empty-rail", name: "Empty" }),
      items: [],
    });
    const brokenRail: ContentRail = {
      category: createCategory({ id: "broken-rail", name: "Broken" }),
      template: ContentCategoryTemplate.SIXTEEN_BY_NINE_STANDARD,
    };
    mockGetNavigation.mockResolvedValue(createNavigation([homeCategory]));
    respondWithPages({
      "home-page": createPage(homeCategory, [newsRail, brokenRail, emptyRail]),
    });

    const appContent = await fetchAppContent();

    expect(getInitialAppContentSection(appContent)?.rails).toEqual([
      newsRail,
      emptyRail,
    ]);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it("keeps a promo banner, whose images sit on the category, not in items", async () => {
    const homeCategory = createPageCategory({ id: "home-page", name: "Home" });
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
    mockGetNavigation.mockResolvedValue(createNavigation([homeCategory]));
    respondWithPages({ "home-page": createPage(homeCategory, [promoRail]) });

    const appContent = await fetchAppContent();

    expect(getInitialAppContentSection(appContent)?.rails).toEqual([promoRail]);
  });

  it("reads a page that carries no rails as an empty one", async () => {
    const homeCategory = createPageCategory({ id: "home-page", name: "Home" });
    const onNowCategory = createPageCategory({ id: "on-now", name: "On Now" });
    const onNowRail = createRail({
      category: createCategory({ id: "live-rail", name: "Live" }),
      items: [{ contentType: "standalone", id: "vod-1", title: "VOD" }],
    });

    mockGetNavigation.mockResolvedValue(
      createNavigation([homeCategory, onNowCategory]),
    );
    respondWithPages({
      "home-page": { category: homeCategory } as ContentPage,
      "on-now": createPage(onNowCategory, [onNowRail]),
    });

    const appContent = await fetchAppContent();

    expect(getInitialAppContentSection(appContent)?.rails).toEqual([]);
  });

  it("throws at startup when a page hydrates no rail at all", async () => {
    const homeCategory = createPageCategory({ id: "home-page", name: "Home" });
    const brokenRail: ContentRail = {
      category: createCategory({ id: "broken-rail", name: "Broken" }),
      template: ContentCategoryTemplate.SIXTEEN_BY_NINE_STANDARD,
    };

    mockGetNavigation.mockResolvedValue(createNavigation([homeCategory]));
    respondWithPages({ "home-page": createPage(homeCategory, [brokenRail]) });

    const appContent = await fetchAppContent();

    expect(getInitialAppContentSection(appContent)?.rails).toEqual([]);
    expect(() => assertInitialHomeContentReady(appContent)).toThrow(
      "Common SDK Home section returned no renderable rails",
    );
  });

  it("drops a section that fails to load without failing the others", async () => {
    const homeCategory = createPageCategory({ id: "home-page", name: "Home" });
    const liveCategory = createPageCategory({
      id: "live-page",
      name: "Live TV",
    });

    mockGetNavigation.mockResolvedValue(
      createNavigation([homeCategory, liveCategory]),
    );
    mockGetPage.mockImplementation(({ categoryId }: { categoryId: string }) =>
      categoryId === "home-page"
        ? Promise.reject(new Error("boom"))
        : Promise.resolve(createPage(liveCategory)),
    );

    const appContent = await fetchAppContent();

    expect(getInitialAppContentSection(appContent)).toBeUndefined();
    expect(getOnNowAppContentSection(appContent)?.pageCategory).toBe(
      liveCategory,
    );
  });

  it("returns undefined when content has not loaded yet", () => {
    expect(getAppContentSection(undefined, "/")).toBeUndefined();
    expect(getInitialAppContentSection(undefined)).toBeUndefined();
    expect(getOnNowAppContentSection(undefined)).toBeUndefined();
  });

  it("requires SDK navigation and renderable first-page rails for startup", () => {
    const homeCategory = createPageCategory({ id: "home-page", name: "Home" });

    expect(() =>
      assertInitialHomeContentReady({
        navigation: createNavigation([homeCategory]),
        sections: [
          {
            navigationItem: homeCategory,
            pageCategory: homeCategory,
            rails: [
              createRail({
                category: createCategory({ id: "rail-1", name: "Rail" }),
              }),
            ],
            route: "/",
          },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      assertInitialHomeContentReady({
        navigation: {
          category: createPageCategory({ id: "root", name: "Root" }),
        },
        sections: [],
      }),
    ).toThrow("Common SDK navigation returned no nav links");
  });
});

describe("getAppContentRail", () => {
  const homeRail = createRail({
    category: createCategory({ id: "shared-id", name: "Home rail" }),
  });
  const sportRail = createRail({
    category: createCategory({ id: "shared-id", name: "Sport rail" }),
  });
  const appContent = {
    navigation: createNavigation([
      createPageCategory({ id: "home", name: "Home" }),
      createPageCategory({ id: "sport", name: "Sport" }),
    ]),
    sections: [
      {
        navigationItem: createCategory({ id: "home", name: "Home" }),
        pageCategory: createCategory({ id: "home", name: "Home" }),
        rails: [homeRail],
        route: "/" as const,
      },
      {
        navigationItem: createCategory({ id: "sport", name: "Sport" }),
        pageCategory: createCategory({ id: "sport", name: "Sport" }),
        rails: [sportRail],
        route: "/sport" as const,
      },
    ],
  };

  test("resolves the rail inside the section it was opened from", () => {
    expect(
      getAppContentRail({
        appContent,
        railId: "shared-id",
        sectionRoute: "/sport",
      }),
    ).toBe(sportRail);
  });

  test("does not reach into another section", () => {
    expect(
      getAppContentRail({
        appContent,
        railId: "shared-id",
        sectionRoute: "/unknown",
      }),
    ).toBeUndefined();
  });

  test("searches every section when the route is unknown, as on a deep link", () => {
    expect(getAppContentRail({ appContent, railId: "shared-id" })).toBe(
      homeRail,
    );
  });
});
