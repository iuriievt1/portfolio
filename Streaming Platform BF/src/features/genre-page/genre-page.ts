import {
  ContentCatalogue,
  type ContentPage,
  type ContentRail,
} from "@bfbs/common-sdk";
import { queryOptions } from "@tanstack/react-query";
import { DEFAULT_RAIL_ITEM_LIMIT } from "@/features/content-rails/utils/rail-content";

const GENRE_PAGE_STALE_TIME_MS = 5 * 60 * 1000;

/** Loads one provider category page without making it part of app startup. */
export function genrePageQueryOptions(categoryId: string) {
  return queryOptions({
    queryKey: ["genrePage", categoryId] as const,
    queryFn: async (): Promise<ContentPage> => {
      const page = await ContentCatalogue.getPage({
        categoryId,
        collectionLimit: DEFAULT_RAIL_ITEM_LIMIT + 1,
      });

      return {
        ...page,
        rails: page.rails?.filter(({ items }) => items !== undefined),
      };
    },
    staleTime: GENRE_PAGE_STALE_TIME_MS,
  });
}

/** Finds a hydrated rail on an on-demand Genre page. */
export function getGenrePageRail(
  page: ContentPage | undefined,
  railId: string,
): ContentRail | undefined {
  return page?.rails?.find((rail) => rail.category.id === railId);
}
