import type { ContentItem } from "@bfbs/common-sdk";
import { ContentCatalogue } from "@bfbs/common-sdk";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CONTINUE_WATCHING_QUERY_KEY } from "@/features/continue-watching/use-continue-watching";
import {
  collectPageItems,
  FIRST_PAGE_PARAM,
  getNextPageParam,
} from "@/features/watch-details/utils/next-page-param";

const EPISODES_PAGE_SIZE = 30;

/** The id to load a season's episodes with; a collapsed season has only its own id. */
export function getSeasonId(season: Pick<ContentItem, "id" | "seasonId">) {
  return season.seasonId ?? season.id;
}

/** A season's episodes in provider order, with the profile's progress; more load as the user scrolls. */
export function useSeasonEpisodes(season: ContentItem | undefined) {
  const seasonId = season ? getSeasonId(season) : undefined;

  const query = useInfiniteQuery({
    enabled: !!seasonId,
    getNextPageParam,
    initialPageParam: FIRST_PAGE_PARAM,
    queryFn: ({ pageParam }) => {
      if (!seasonId) {
        throw new Error("Cannot load episodes without a season id.");
      }

      return ContentCatalogue.getSeasonEpisodes({
        limit: EPISODES_PAGE_SIZE,
        ...pageParam,
        seasonId,
        shared: false,
      });
    },
    // Under continue-watching, so progress refreshes after playback.
    queryKey: [...CONTINUE_WATCHING_QUERY_KEY, "seasonEpisodes", seasonId],
  });

  /** Ignores repeat calls. */
  const fetchNextPage = () => {
    void query.fetchNextPage({ cancelRefetch: false });
  };

  /** Skips while a page loads or after one has failed. */
  const loadNextPage = () => {
    if (
      query.hasNextPage &&
      !(query.isFetching || query.isFetchNextPageError)
    ) {
      fetchNextPage();
    }
  };

  /** Retries the failed page, or the first one. */
  const retry = () => {
    if (query.data) {
      fetchNextPage();
      return;
    }

    void query.refetch();
  };

  return {
    episodes: query.data ? collectPageItems(query.data.pages) : [],
    hasError: query.isLoadingError || query.isFetchNextPageError,
    isLoadingFirstPage: query.isLoading,
    isLoadingNextPage: query.isFetchingNextPage,
    loadNextPage,
    retry,
  };
}
