import {
  ContentCategoryTemplate,
  type ContentItem,
  type ContentRail,
  isCategoryNavigationItem,
} from "@bfbs/common-sdk";
import { getContentPlaybackType } from "@/features/content-rails/content";
import {
  getTilePresentation,
  TILE_VARIANT,
} from "@/features/content-rails/utils/tile-metrics";

/** BFBS default. */
export const DEFAULT_RAIL_ITEM_LIMIT = 15;
const SEE_ALL_DISABLED = "none";
const CONTINUE_WATCHING_RAIL_ID = "Continue";
const CONTINUE_WATCHING_MAX_ITEMS = 30;

/** Category-navigation rails contain complete, ordered destination lists. */
export function isCategoryNavigationRail(rail: ContentRail): boolean {
  const items = rail.items ?? [];

  return items.length > 0 && items.every(isCategoryNavigationItem);
}

/** Top 10 rails number their tiles. */
export function isRankedRail(rail: ContentRail): boolean {
  return (
    rail.template === ContentCategoryTemplate.SIXTEEN_BY_NINE_DESIGNED_LARGE ||
    rail.template === ContentCategoryTemplate.SIXTEEN_BY_NINE_DESIGNED_SMALL
  );
}

/** GO's Continue Watching rail. */
export function isContinueWatchingRail(rail: ContentRail): boolean {
  return rail.category.id === CONTINUE_WATCHING_RAIL_ID;
}

function getRailItemTotal(rail: ContentRail): number {
  const pageLength = rail.items?.length ?? 0;
  const providerTotal = rail.metadata?.total ?? 0;

  return providerTotal > pageLength
    ? providerTotal
    : getRenderableContentItems(rail, rail.items ?? []).length;
}

const RANKED_RAIL_ITEM_LIMIT = 10;

/** Use 30 for Continue Watching, 10 for Top 10 rails, otherwise the provider maximum or the default. */
export function getRailItemLimit(rail: ContentRail): number {
  if (isContinueWatchingRail(rail)) {
    return CONTINUE_WATCHING_MAX_ITEMS;
  }

  const configuredLimit = rail.contentDisplay?.maxItems;
  const limit =
    configuredLimit !== undefined && configuredLimit > 0
      ? configuredLimit
      : DEFAULT_RAIL_ITEM_LIMIT;

  return isRankedRail(rail) ? Math.min(limit, RANKED_RAIL_ITEM_LIMIT) : limit;
}

/** Excludes items that cannot fulfil a vertical rail's direct-play contract. */
export function getRenderableContentItems(
  rail: Pick<ContentRail, "template">,
  items: ContentItem[],
): ContentItem[] {
  return getTilePresentation(rail.template).variant === TILE_VARIANT.VERTICAL
    ? items.filter((item) => getContentPlaybackType(item) === "vod")
    : items;
}

/** Capped at the rail limit, excluding non-playable items from vertical rails. */
export function getDisplayedTiles(rail: ContentRail): ContentItem[] {
  if (isCategoryNavigationRail(rail)) {
    return rail.items ?? [];
  }

  return getRenderableContentItems(rail, rail.items ?? []).slice(
    0,
    getRailItemLimit(rail),
  );
}

/** Unless disabled, nothing is hidden, or the rail is Top 10 or Continue Watching. */
export function shouldShowViewAll(rail: ContentRail): boolean {
  if (
    isCategoryNavigationRail(rail) ||
    isRankedRail(rail) ||
    isContinueWatchingRail(rail)
  ) {
    return false;
  }

  const seeAllPosition = rail.display?.seeAllPosition?.toLowerCase();

  if (seeAllPosition === SEE_ALL_DISABLED) {
    return false;
  }

  return getRailItemTotal(rail) > getDisplayedTiles(rail).length;
}
