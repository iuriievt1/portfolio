import type { ContentItem } from "@bfbs/common-sdk";
import { TileProgressBar } from "@/features/content-rails";
import { useContinueWatching } from "@/features/continue-watching";
import { usePlaybackLauncher } from "@/features/video-player";
import { getContinueWatching } from "@/features/watch-details/utils/watch-details-metadata";
import { ContentList } from "../content-list/content-list";

export function ContinueWatchingPage() {
  const { data, isError, isPending, refetch } = useContinueWatching();
  const { openVodAsset } = usePlaybackLauncher();

  const play = (item: ContentItem) => {
    void openVodAsset({ id: item.id, title: item.title });
  };

  const renderProgress = (item: ContentItem) => {
    const progress = getContinueWatching(item)?.progress;

    if (progress === undefined) {
      return null;
    }

    return <TileProgressBar progress={progress} />;
  };

  // Screen readers can't see the bar, so the card says it, e.g. "40% watched".
  const describeProgress = (item: ContentItem) => {
    const progress = getContinueWatching(item)?.progress;

    if (progress === undefined) {
      return undefined;
    }

    return `${Math.round(progress * 100)}% watched`;
  };

  return (
    <ContentList
      emptyMessage="Watch something and it will appear here."
      getAccessibilityValue={describeProgress}
      isError={isError}
      isPending={isPending}
      items={data?.items}
      onItemPress={play}
      onRetry={() => void refetch()}
      renderOverlay={renderProgress}
      title="Continue Watching"
    />
  );
}
