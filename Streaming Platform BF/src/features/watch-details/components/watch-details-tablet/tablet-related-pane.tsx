import type { ContentItem } from "@bfbs/common-sdk";
import { useRouter } from "expo-router";
import { RelatedGrid } from "@/features/watch-details/components/related-pane/related-grid";
import {
  RELATED_COLUMNS,
  RELATED_TILE_GAP,
} from "@/features/watch-details/components/watch-details-tablet/tablet-metrics";
import { useRelatedAssets } from "@/features/watch-details/hooks/use-related-assets";

/** Tablet Related tab: the same grid, with columns that follow the width. */
export function TabletRelatedPane({ asset }: { asset: ContentItem }) {
  const router = useRouter();
  const { isError, isLoading, items } = useRelatedAssets(asset);

  return (
    <RelatedGrid
      className="flex-row flex-wrap gap-y-6 px-10"
      columnGap={RELATED_TILE_GAP}
      columns={RELATED_COLUMNS}
      isError={isError}
      isLoading={isLoading}
      items={items}
      onSelect={(item) => router.push(`./${item.id}`)}
    />
  );
}
