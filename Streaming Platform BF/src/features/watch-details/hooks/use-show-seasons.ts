import type { ContentItem, ContentList } from "@bfbs/common-sdk";
import { ContentCatalogue } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import { getSeasonId } from "@/features/watch-details/hooks/use-season-episodes";
import {
  collectPageItems,
  FIRST_PAGE_PARAM,
  getNextPageParam,
  type PageParam,
} from "@/features/watch-details/utils/next-page-param";

const SEASONS_PAGE_SIZE = 30;
// Stops a provider that never ends its list.
const MAX_SEASON_PAGES = 10;
const SEASONS_STALE_TIME_MS = 5 * 60 * 1000;

async function seasonHasEpisodes(season: ContentItem): Promise<boolean> {
  try {
    const { items } = await ContentCatalogue.getSeasonEpisodes({
      limit: 1,
      seasonId: getSeasonId(season),
      shared: false,
    });

    return items.length > 0;
  } catch {
    return true;
  }
}

async function fetchShowSeasons(showId: string): Promise<ContentItem[]> {
  const pages: ContentList[] = [];
  let pageParam: PageParam | undefined = FIRST_PAGE_PARAM;

  // The selector needs every season, so all pages load together.
  while (pageParam && pages.length < MAX_SEASON_PAGES) {
    const page: ContentList = await ContentCatalogue.getShowSeasons({
      limit: SEASONS_PAGE_SIZE,
      ...pageParam,
      showId,
    });

    pages.push(page);
    pageParam = getNextPageParam(page, pages);
  }

  const seasons = collectPageItems(pages);
  // A season with no episodes is hidden from the picker.
  const hasEpisodes = await Promise.all(seasons.map(seasonHasEpisodes));

  return seasons.filter((_season, index) => hasEpisodes[index]);
}

/** A show's seasons that have episodes, in provider order; empty for a show without any. */
export function useShowSeasons(showId: string | undefined) {
  return useQuery<ContentItem[]>({
    enabled: !!showId,
    queryFn: () => {
      if (!showId) {
        throw new Error("Cannot load seasons without a show id.");
      }

      return fetchShowSeasons(showId);
    },
    queryKey: ["showSeasons", showId],
    staleTime: SEASONS_STALE_TIME_MS,
  });
}
