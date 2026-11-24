import {
  ContentSource,
  Search,
  SearchMatchMode,
  type SearchResultSet,
  SearchSortField,
} from "@bfbs/common-sdk";
import { queryOptions, skipToken } from "@tanstack/react-query";

export const SEARCH_DEBOUNCE_MS = 500;
export const SEARCH_MINIMUM_TERM_LENGTH = 3;
export const SEARCH_RESULTS_LIMIT = 30;

const SEARCH_RESULTS_QUERY_KEY = ["search", "results"] as const;

/** Removes whitespace that must not be included in search validation or requests. */
export function normalizeSearchTerm(term: string): string {
  return term.trim();
}

/** Whether a normalized term is long enough to submit. */
export function isValidSearchTerm(term: string): boolean {
  return term.length >= SEARCH_MINIMUM_TERM_LENGTH;
}

/** Builds the initial Common SDK results query for a committed search term. */
export function searchResultsQueryOptions(term: string | null) {
  const normalizedTerm = normalizeSearchTerm(term ?? "");
  const baseInput = isValidSearchTerm(normalizedTerm)
    ? {
        limit: SEARCH_RESULTS_LIMIT,
        matchMode: SearchMatchMode.PREFIX,
        term: normalizedTerm,
      }
    : null;
  const vodInput = baseInput
    ? { ...baseInput, collapsed: true, sources: [ContentSource.VOD] }
    : null;
  const liveInput = baseInput
    ? {
        ...baseInput,
        collapsed: false,
        sort: { field: SearchSortField.DATE },
        sources: [ContentSource.LTV],
      }
    : null;

  return queryOptions<SearchResultSet>({
    queryFn:
      vodInput && liveInput
        ? async () => {
            const [vodResults, liveResults] = await Promise.all([
              Search.getSearchResultsForTerm(vodInput),
              Search.getSearchResultsForTerm(liveInput),
            ]);
            const items = [...vodResults.items, ...liveResults.items].slice(
              0,
              SEARCH_RESULTS_LIMIT,
            );

            return {
              items,
              metadata: {
                count: items.length,
                total:
                  (vodResults.metadata?.total ?? vodResults.items.length) +
                  (liveResults.metadata?.total ?? liveResults.items.length),
              },
              query: normalizedTerm,
            };
          }
        : skipToken,
    queryKey: [...SEARCH_RESULTS_QUERY_KEY, vodInput, liveInput],
  });
}
