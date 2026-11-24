import {
  ContentCatalogue,
  type ContentCollection,
  type ContentItem,
  type ContentRail,
} from "@bfbs/common-sdk";
import { useInfiniteQuery } from "@tanstack/react-query";

export const RAIL_ITEMS_PAGE_SIZE = 30;
const RAIL_ITEMS_QUERY_KEY = ["railItems"] as const;
const RAIL_ITEMS_STALE_TIME_MS = 5 * 60 * 1000;

/** The provider builds a page's items, so a missing list is read as empty. */
function getPageItems(page: ContentCollection): readonly ContentItem[] {
  return page.items ?? [];
}

function countItems(pages: readonly ContentCollection[]): number {
  return pages.reduce((total, page) => total + getPageItems(page).length, 0);
}

function collectItems(pages: readonly ContentCollection[]): ContentItem[] {
  const seenIds = new Set<string>();

  return pages.flatMap((page) =>
    getPageItems(page).filter((item) => {
      if (seenIds.has(item.id)) {
        return false;
      }

      seenIds.add(item.id);

      return true;
    }),
  );
}

function getNextOffset(
  lastPage: ContentCollection,
  pages: ContentCollection[],
): number | undefined {
  const pageSize = getPageItems(lastPage).length;

  if (pageSize === 0) {
    return undefined;
  }

  const loadedCount = countItems(pages);
  const total = lastPage.metadata?.total;

  if (Number.isFinite(total)) {
    return loadedCount >= total ? undefined : loadedCount;
  }

  /** A provider that reports no total must not page for ever. */
  return pageSize < RAIL_ITEMS_PAGE_SIZE ? undefined : loadedCount;
}

/** A rail's items, page by page. */
export function useRailItems(rail: ContentRail) {
  const query = useInfiniteQuery({
    getNextPageParam: getNextOffset,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      ContentCatalogue.getCollectionContent({
        categoryId: rail.category.id,
        limit: RAIL_ITEMS_PAGE_SIZE,
        offset: pageParam,
      }),
    queryKey: [...RAIL_ITEMS_QUERY_KEY, rail.category.id],
    staleTime: RAIL_ITEMS_STALE_TIME_MS,
  });

  /** Ignores repeat calls. */
  const fetchNextPage = () => {
    void query.fetchNextPage({ cancelRefetch: false });
  };

  /** Skips an errored page. */
  const loadNextPage = () => {
    if (
      query.hasNextPage &&
      !(query.isFetchingNextPage || query.isFetchNextPageError)
    ) {
      fetchNextPage();
    }
  };

  /** Retries the failed page. */
  const retry = () => {
    if (query.data) {
      fetchNextPage();
      return;
    }

    void query.refetch();
  };

  const items = query.data
    ? collectItems(query.data.pages)
    : (rail.items ?? []);

  return {
    hasError: query.isError,
    isLoadingFirstPage: query.isPending,
    isLoadingNextPage: query.isFetchingNextPage,
    items,
    loadNextPage,
    retry,
  };
}
