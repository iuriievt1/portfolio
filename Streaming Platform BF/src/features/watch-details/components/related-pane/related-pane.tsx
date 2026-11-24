import type { ContentItem } from "@bfbs/common-sdk";
import { useRouter } from "expo-router";
import { RelatedGrid } from "@/features/watch-details/components/related-pane/related-grid";
import { useRelatedAssets } from "@/features/watch-details/hooks/use-related-assets";

const COLUMNS = 2;
const COLUMN_GAP = 8;

/** Phone Related tab: a two-column grid of VOD recommendations. */
export function RelatedPane({ asset }: { asset: ContentItem }) {
  const router = useRouter();
  const { isError, isLoading, items } = useRelatedAssets(asset);

  return (
    <RelatedGrid
      className="flex-row flex-wrap gap-y-6"
      columnGap={COLUMN_GAP}
      columns={COLUMNS}
      isError={isError}
      isLoading={isLoading}
      items={items}
      onSelect={(item) => router.push(`./${item.id}`)}
    />
  );
}
