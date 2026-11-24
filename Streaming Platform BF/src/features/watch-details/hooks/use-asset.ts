import type { ContentItem } from "@bfbs/common-sdk";
import { ContentCatalogue } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";

const ASSET_STALE_TIME_MS = 5 * 60 * 1000;

export function useAsset(assetId: string | undefined) {
  return useQuery<ContentItem>({
    enabled: !!assetId,
    queryFn: () => {
      if (!assetId) {
        throw new Error("Cannot load an asset without an id.");
      }

      return ContentCatalogue.getAsset({ assetId, shared: false });
    },
    queryKey: ["asset", assetId],
    staleTime: ASSET_STALE_TIME_MS,
  });
}
