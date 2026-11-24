import type { ContentItem } from "@bfbs/common-sdk";
import { useRouter } from "expo-router";
import {
  getProviderContentType,
  getSeriesShowId,
} from "@/features/content-rails/content";
import { RelatedGrid } from "@/features/watch-details/components/related-pane/related-grid";
import {
  RELATED_COLUMNS,
  RELATED_TILE_GAP,
} from "@/features/watch-details/components/watch-details-tablet/tablet-metrics";
import { useRelatedAssets } from "@/features/watch-details/hooks/use-related-assets";

// The phone grid matches the movie page's.
const PHONE_COLUMNS = 2;
const PHONE_COLUMN_GAP = 8;

/** A show's Related tab: its recommendations in the phone or tablet grid. */
export function SeriesRelatedPane({
  isTablet,
  show,
  showId,
}: {
  isTablet: boolean;
  show: ContentItem;
  showId: string | undefined;
}) {
  const router = useRouter();
  const { isError, isLoading, items } = useRelatedAssets(show, showId);

  const handleSelect = (item: ContentItem) => {
    const contentType = getProviderContentType(item);

    // A show or season opens its series page; a film or episode its VOD page.
    // Push, so Back returns to this series.
    if (contentType === "show" || contentType === "season") {
      router.push(`../show/${getSeriesShowId(item)}`);
      return;
    }

    router.push(`../watch/${item.id}`);
  };

  return (
    <RelatedGrid
      className="flex-row flex-wrap gap-y-6"
      columnGap={isTablet ? RELATED_TILE_GAP : PHONE_COLUMN_GAP}
      columns={isTablet ? RELATED_COLUMNS : PHONE_COLUMNS}
      isError={isError}
      isLoading={isLoading}
      items={items}
      onSelect={handleSelect}
    />
  );
}
