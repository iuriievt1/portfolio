export { NoResults } from "./components/no-results";
export { SearchInput } from "./components/search-input";
export {
  SearchResultsGrid,
  type SearchResultsGridProps,
} from "./components/search-results-grid";
export type { SearchResultsState } from "./hooks/use-search-results";
export { useSearchResults } from "./hooks/use-search-results";
export {
  prepareSearchResultItems,
  type SearchResultCategory,
  type SearchResultDestination,
  type SearchResultItem,
} from "./search-result-items";
export {
  isValidSearchTerm,
  normalizeSearchTerm,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MINIMUM_TERM_LENGTH,
  SEARCH_RESULTS_LIMIT,
  searchResultsQueryOptions,
} from "./search-results";
export { SearchScreen } from "./search-screen";
export {
  SEARCH_RECOMMENDATION_LIMIT,
  TOP_SEARCHES_QUERY_KEY,
  topSearchesQueryOptions,
} from "./top-searches";
