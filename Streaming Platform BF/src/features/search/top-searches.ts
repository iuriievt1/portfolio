import { ContentSource, Search } from "@bfbs/common-sdk";
import { queryOptions } from "@tanstack/react-query";

export const SEARCH_RECOMMENDATION_LIMIT = 15;
export const TOP_SEARCHES_QUERY_KEY = ["search", "topSearches"] as const;

/** Builds the shared Common SDK query for Search recommendations. */
export function topSearchesQueryOptions() {
  return queryOptions({
    queryFn: () =>
      Search.getTopSearches({
        limit: SEARCH_RECOMMENDATION_LIMIT,
        sources: [ContentSource.VOD, ContentSource.LTV],
      }),
    queryKey: TOP_SEARCHES_QUERY_KEY,
    refetchOnMount: false,
  });
}
