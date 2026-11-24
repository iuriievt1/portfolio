import { ContentCatalogue, type ContentItem } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import {
  hasRelatedContent,
  RELATED_ASSETS_LIMIT,
  selectRelatedAssets,
} from "@/features/watch-details/related-content";

const RELATED_QUERY_KEY = ["watchDetails", "relatedAssets"] as const;
const RELATED_STALE_TIME_MS = 5 * 60 * 1000;

/** Related recommendations for the asset, or for the show when `showId` is set. */
export function useRelatedAssets(asset: ContentItem, showId?: string) {
  const query = useQuery({
    enabled: Boolean(showId) || hasRelatedContent(asset),
    queryFn: () =>
      ContentCatalogue.getRelatedRecommendations(
        showId
          ? { limit: RELATED_ASSETS_LIMIT, showId }
          : { contentId: asset.id, limit: RELATED_ASSETS_LIMIT },
      ),
    queryKey: [...RELATED_QUERY_KEY, showId ?? asset.id],
    staleTime: RELATED_STALE_TIME_MS,
  });

  return {
    isError: query.isError,
    isLoading: query.isLoading,
    items: selectRelatedAssets(query.data, { includeSeries: Boolean(showId) }),
  };
}
