import type { ContentItem } from "@bfbs/common-sdk";
import { useRouter } from "expo-router";
import { getSeriesShowId } from "@/features/content-rails/content";
import { useFavourites } from "@/features/favourites";
import { ContentList } from "../content-list/content-list";

// My List: the content the active profile has saved.
export function MyListPage() {
  const router = useRouter();
  const { data, isError, isPending, refetch } = useFavourites();

  const openWatchDetails = (item: ContentItem) => {
    const showId = getSeriesShowId(item);

    // A saved series item opens the series page.
    if (showId) {
      router.navigate({
        params: { showId },
        pathname: "/my-bfbs/show/[showId]",
      });
      return;
    }

    router.navigate({
      params: { assetId: item.id },
      pathname: "/my-bfbs/watch/[assetId]",
    });
  };

  return (
    <ContentList
      emptyMessage="Add something to your list and it will appear here."
      isError={isError}
      isPending={isPending}
      items={data?.items}
      onItemPress={openWatchDetails}
      onRetry={() => void refetch()}
      title="My List"
    />
  );
}
