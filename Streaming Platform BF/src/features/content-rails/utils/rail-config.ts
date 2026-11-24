import {
  ContentCategoryTemplate,
  type ContentRail,
  isCategoryNavigationItem,
} from "@bfbs/common-sdk";
import { getContentTileType } from "@/features/content-rails/content";
import type { PageRail } from "@/features/content-rails/types";
import { isContinueWatchingRail } from "@/features/content-rails/utils/rail-content";
import {
  getTilePresentation,
  TILE_VARIANT,
  type TilePresentation,
} from "@/features/content-rails/utils/tile-metrics";

type PageRailKind = PageRail["kind"] | "hidden";

type PageRailConfig = {
  kind: PageRailKind;
  presentation: TilePresentation;
};

/** GO promo banners are placeholder categories that carry their own images. */
export function isPromoRail(rail: ContentRail): boolean {
  return (
    rail.category.type === "placeholder" && Boolean(rail.category.media?.length)
  );
}

function isHeroRail(rail: ContentRail): boolean {
  return (
    rail.template === ContentCategoryTemplate.HERO ||
    [rail.category.id, rail.category.name].some((label) => {
      const normalized = label
        .replace(/([a-z])([A-Z])/gu, "$1 $2")
        .replace(/[-_&/]+/gu, " ")
        .toLowerCase();
      const compact = normalized.replace(/[^a-z0-9]+/gu, "");

      return (
        /\bhero\b/u.test(normalized) ||
        /^featured(?:home|vod|sport|sports|live|livetv|onnow|tv|tvfilm|tvandfilm|film|films|movie|movies|show|shows|more)$/u.test(
          compact,
        )
      );
    })
  );
}

function getPageRailKind(
  rail: ContentRail,
  presentation: TilePresentation,
): PageRailKind {
  // Before the Hero rule: a banner has no items and uses GO's "spotlight" (HERO).
  if (isPromoRail(rail)) {
    return "promo";
  }

  const items = rail.items ?? [];

  if (items.length === 0) {
    return "hidden";
  }

  if (isHeroRail(rail)) {
    return "hero";
  }

  // Episodes with a channel would make this a live rail.
  if (isContinueWatchingRail(rail)) {
    return "content";
  }

  if (items.every(isCategoryNavigationItem)) {
    return "category-navigation";
  }

  const tileTypes = items.map(getContentTileType);

  if (tileTypes.every((type) => type === "channel")) {
    return "channels";
  }

  if (
    presentation.variant === TILE_VARIANT.LANDSCAPE &&
    tileTypes.every((type) => type === "live" || type === "channel")
  ) {
    return "live-channels";
  }

  return tileTypes.some(Boolean) ? "content" : "hidden";
}

/** Normalises provider content and presentation into a Mobile rail renderer. */
export function getPageRailConfig(rail: ContentRail): PageRailConfig {
  const presentation = getTilePresentation(rail.template);

  return { kind: getPageRailKind(rail, presentation), presentation };
}
