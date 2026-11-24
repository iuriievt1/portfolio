import {
  ContentCatalogue,
  type ContentCategory,
  type ContentItem,
  type ContentRail,
  type NavigationNode,
  type ProgrammeGuide,
} from "@bfbs/common-sdk";
import { queryOptions } from "@tanstack/react-query";
import {
  getContentChannelId,
  getProviderContentType,
} from "@/features/content-rails/content";
import { isPromoRail } from "@/features/content-rails/utils/rail-config";
import { DEFAULT_RAIL_ITEM_LIMIT } from "@/features/content-rails/utils/rail-content";
import { reportError } from "@/infra/error";

const APP_CONTENT_STALE_TIME_MS = 5 * 60 * 1000;
const APP_CONTENT_QUERY_KEY = ["appContent"] as const;
const PROGRAMME_GUIDE_LIMIT = 2;
/** One past the rail default, so a rail whose total the provider omits still shows View All. */
const RAIL_INITIAL_ITEM_LIMIT = DEFAULT_RAIL_ITEM_LIMIT + 1;

export const HOME_SECTION_ROUTE = "/";
export const ON_NOW_SECTION_ROUTE = "/on-now";

const RESERVED_ROUTE_SEGMENTS = new Set([
  "channel",
  "home",
  "my-bfbs",
  "on-now",
  "player",
  "search",
  "storybook",
  "view-all",
]);
const HOME_SECTION_IDENTIFIERS = new Set(["home"]);
const ON_NOW_SECTION_IDENTIFIERS = new Set([
  "livetv",
  "livetvpage",
  "live",
  "onnow",
]);

export type AppSectionRoute = "/" | `/${string}`;

export type AppContentSection = {
  navigationItem: ContentCategory;
  pageCategory: ContentCategory;
  rails: ContentRail[];
  route: AppSectionRoute;
};

export type AppContent = {
  navigation: NavigationNode;
  sections: AppContentSection[];
};

const CONTENT_PAGE_TYPE = "category_list";

function needsProgrammeGuide(rails: readonly ContentRail[]) {
  return rails.some((rail) =>
    rail.items?.some(
      (item) =>
        getProviderContentType(item) === "episode" &&
        !getContentChannelId(item),
    ),
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normaliseSectionIdentifier(value: string): string {
  return slugify(value).replace(/-/g, "");
}

function getPreferredSectionRoute(
  page: ContentCategory,
): AppSectionRoute | undefined {
  const identifiers = [page.id, page.name].map(normaliseSectionIdentifier);

  if (
    identifiers.some((identifier) => HOME_SECTION_IDENTIFIERS.has(identifier))
  ) {
    return HOME_SECTION_ROUTE;
  }

  if (
    identifiers.some((identifier) => ON_NOW_SECTION_IDENTIFIERS.has(identifier))
  ) {
    return ON_NOW_SECTION_ROUTE;
  }

  return undefined;
}

function buildSectionRoutes(
  pages: readonly ContentCategory[],
): AppSectionRoute[] {
  const usedSlugs = new Set(RESERVED_ROUTE_SEGMENTS);
  const usedRoutes = new Set<AppSectionRoute>();

  const buildUniqueSlug = (page: ContentCategory) => {
    const slugs = [slugify(page.name), slugify(page.id)].filter(Boolean);
    const baseSlug = slugs.find((slug) => !usedSlugs.has(slug)) ?? "section";
    let uniqueSlug = baseSlug;
    let suffix = 2;

    while (usedSlugs.has(uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    usedSlugs.add(uniqueSlug);

    return uniqueSlug;
  };

  return pages.map((page): AppSectionRoute => {
    const preferredRoute = getPreferredSectionRoute(page);

    if (preferredRoute && !usedRoutes.has(preferredRoute)) {
      usedRoutes.add(preferredRoute);
      return preferredRoute;
    }

    const route = `/${buildUniqueSlug(page)}` as AppSectionRoute;
    usedRoutes.add(route);

    return route;
  });
}

function addProgrammeChannelIds(
  rails: readonly ContentRail[],
  programmeGuide: ProgrammeGuide,
): ContentRail[] {
  const channelIdByProgrammeId = new Map(
    programmeGuide.channels.flatMap(({ channelId, programmes }) =>
      programmes.map((programme) => [programme.id, channelId] as const),
    ),
  );

  return rails.map((rail): ContentRail => {
    const { items } = rail;

    if (!items) {
      return rail;
    }

    let enrichedItems: ContentItem[] | undefined;

    items.forEach((item, index) => {
      if (
        getProviderContentType(item) !== "episode" ||
        getContentChannelId(item)
      ) {
        return;
      }

      const channelId = channelIdByProgrammeId.get(item.id);

      if (channelId) {
        enrichedItems ??= [...items];
        enrichedItems[index] = { ...item, channelId };
      }
    });

    return enrichedItems ? { ...rail, items: enrichedItems } : rail;
  });
}

async function fetchProgrammeGuide(): Promise<ProgrammeGuide> {
  const channels = await ContentCatalogue.getAllChannels();

  return channels.length
    ? ContentCatalogue.getProgrammeGuide({
        programmeLimit: PROGRAMME_GUIDE_LIMIT,
        size: channels.length,
      })
    : { channels: [], totalChannels: 0 };
}

async function addProgrammeChannelIdsIfAvailable(
  rails: ContentRail[],
  getProgrammeGuide: () => Promise<ProgrammeGuide>,
): Promise<ContentRail[]> {
  if (!needsProgrammeGuide(rails)) {
    return rails;
  }

  try {
    return addProgrammeChannelIds(rails, await getProgrammeGuide());
  } catch (error) {
    reportError(error, {
      tags: {
        area: "content_rails",
        operation: "programme_guide_enrichment",
      },
    });

    return rails;
  }
}

async function fetchSection(
  route: AppSectionRoute,
  pageSummary: ContentCategory,
  getProgrammeGuide: () => Promise<ProgrammeGuide>,
): Promise<AppContentSection> {
  const page = await ContentCatalogue.getPage({
    categoryId: pageSummary.id,
    collectionLimit: RAIL_INITIAL_ITEM_LIMIT,
  });

  const rails = page.rails ?? [];
  /**
   * A rail without `items` is not renderable. `getPage` may legitimately return
   * structural rails this way, so omit them without reporting each one as an
   * application failure. An empty `items` array is hydrated and remains valid.
   * Promo banners are kept: their images sit on the category, not in items.
   */
  const hydratedRails = rails.filter(
    (rail) => rail.items !== undefined || isPromoRail(rail),
  );

  const enrichedRails = await addProgrammeChannelIdsIfAvailable(
    hydratedRails,
    getProgrammeGuide,
  );

  return {
    navigationItem: pageSummary,
    pageCategory: page.category,
    rails: enrichedRails,
    route,
  };
}

export async function fetchAppContent(): Promise<AppContent> {
  const navigation = await ContentCatalogue.getNavigation();
  const pages = (navigation.children ?? [])
    .map((node) => node.category)
    .filter((category) => category.type === CONTENT_PAGE_TYPE);
  const routes = buildSectionRoutes(pages);
  let programmeGuidePromise: Promise<ProgrammeGuide> | undefined;
  const getProgrammeGuide = () => {
    programmeGuidePromise ??= fetchProgrammeGuide();

    return programmeGuidePromise;
  };
  const sectionResults = await Promise.allSettled(
    pages.map((page, index) =>
      fetchSection(routes[index] ?? "/", page, getProgrammeGuide),
    ),
  );
  const sections = sectionResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  return { navigation, sections };
}

export const appContentQueryOptions = queryOptions({
  queryKey: APP_CONTENT_QUERY_KEY,
  queryFn: fetchAppContent,
  staleTime: APP_CONTENT_STALE_TIME_MS,
});

/** Finds a section by route. */
export function getAppContentSection(
  appContent: AppContent | undefined,
  route: AppSectionRoute,
): AppContentSection | undefined {
  return appContent?.sections.find((section) => section.route === route);
}

/** Finds a rail within its section. */
export function getAppContentRail({
  appContent,
  railId,
  sectionRoute,
}: {
  appContent: AppContent | undefined;
  railId: string;
  sectionRoute?: AppSectionRoute | undefined;
}): ContentRail | undefined {
  const rails = sectionRoute
    ? (getAppContentSection(appContent, sectionRoute)?.rails ?? [])
    : (appContent?.sections.flatMap((section) => section.rails) ?? []);

  return rails.find((rail) => rail.category.id === railId);
}

function getSdkNavigationTitle(section: AppContentSection | undefined) {
  return section?.pageCategory.name ?? section?.navigationItem.name;
}

/** Returns the SDK navigation title to display for a local app route. */
export function getAppContentNavigationTitle(
  appContent: AppContent | undefined,
  route: AppSectionRoute,
): string | undefined {
  return getSdkNavigationTitle(getAppContentSection(appContent, route));
}

/** Resolves the first Common SDK navigation page to its loaded section. */
export function getInitialAppContentSection(
  appContent: AppContent | undefined,
): AppContentSection | undefined {
  return getAppContentSection(appContent, HOME_SECTION_ROUTE);
}

/** Resolves the second Common SDK navigation page to the On Now tab section. */
export function getOnNowAppContentSection(
  appContent: AppContent | undefined,
): AppContentSection | undefined {
  return getAppContentSection(appContent, ON_NOW_SECTION_ROUTE);
}

/** Ensures startup has enough SDK content to render Home immediately. */
export function assertInitialHomeContentReady(appContent: AppContent): void {
  if (!appContent.navigation.children?.length) {
    throw new Error("Common SDK navigation returned no nav links");
  }

  const homeSection = getInitialAppContentSection(appContent);

  if (!homeSection?.rails.length) {
    throw new Error("Common SDK Home section returned no renderable rails");
  }
}
