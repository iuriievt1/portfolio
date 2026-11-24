import type { ContentItem } from "@bfbs/common-sdk";
import {
  getContentPlaybackType,
  getSeriesShowId,
} from "@/features/content-rails/content";

export const RELATED_ASSETS_LIMIT = 30;

/** Related content is a VOD-only feature, so live assets never request it. */
export function hasRelatedContent(asset: ContentItem): boolean {
  return getContentPlaybackType(asset) === "vod";
}

/** Whether the grid can open an item; a show's page also opens shows, seasons and VOD episodes. */
function canOpen(item: ContentItem, includeSeries: boolean): boolean {
  // A film.
  if (getContentPlaybackType(item) === "vod") {
    return true;
  }

  if (!includeSeries || item.externalViewingOptions?.externalOnly) {
    return false;
  }

  // A show, a season, or an episode not on a channel.
  return Boolean(getSeriesShowId(item));
}

/** Keeps the recommendations the grid can open, in provider order, each once. */
export function selectRelatedAssets(
  items: ContentItem[] | undefined,
  { includeSeries = false }: { includeSeries?: boolean } = {},
): ContentItem[] {
  const seenIds = new Set<string>();

  return (items ?? [])
    .filter((item) => {
      if (!canOpen(item, includeSeries) || seenIds.has(item.id)) {
        return false;
      }

      seenIds.add(item.id);

      return true;
    })
    .slice(0, RELATED_ASSETS_LIMIT);
}
