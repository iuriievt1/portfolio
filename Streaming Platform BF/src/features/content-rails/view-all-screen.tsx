import type { ContentItem, ContentRail } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { AppSectionRoute } from "@/features/content-rails/app-content";
import {
  appContentQueryOptions,
  getAppContentRail,
} from "@/features/content-rails/app-content";
import { ContentGrid } from "@/features/content-rails/components/content-grid/content-grid";
import { ContentGridSkeleton } from "@/features/content-rails/components/content-grid/content-grid-skeleton";
import {
  getContentPlaybackType,
  getSeriesShowId,
  handleRailItemPress,
} from "@/features/content-rails/content";
import { useRailItems } from "@/features/content-rails/hooks/use-rail-items";
import {
  genrePageQueryOptions,
  getGenrePageRail,
} from "@/features/genre-page/genre-page";
import { usePlaybackLauncher } from "@/features/video-player";
import { ErrorFullScreen, errorCodes, useErrorAction } from "@/infra/error";

function PagedContentGrid({
  onClose,
  onTilePress,
  rail,
}: {
  onClose: () => void;
  onTilePress: (rail: ContentRail, item: ContentItem) => void;
  rail: ContentRail;
}) {
  const {
    hasError,
    isLoadingFirstPage,
    isLoadingNextPage,
    items,
    loadNextPage,
    retry,
  } = useRailItems(rail);

  // Waits for the first page, so the grid opens at the 16th item without a jump.
  if (isLoadingFirstPage) {
    return <ContentGridSkeleton onClose={onClose} />;
  }

  return (
    <ContentGrid
      onClose={onClose}
      onTilePress={onTilePress}
      pagination={{
        hasError,
        isLoadingNextPage,
        items,
        onEndReached: loadNextPage,
        onRetry: retry,
      }}
      rail={rail}
    />
  );
}

/** View All page. */
export function ViewAllScreen() {
  const router = useRouter();
  const { openVodAsset } = usePlaybackLauncher();
  const { genreCategoryId, railId, sectionRoute } = useLocalSearchParams<{
    genreCategoryId?: string;
    railId: string;
    sectionRoute?: AppSectionRoute;
  }>();
  const appContentQuery = useQuery(appContentQueryOptions);
  const genrePageQuery = useQuery({
    ...genrePageQueryOptions(genreCategoryId ?? ""),
    enabled: Boolean(genreCategoryId),
  });
  const rail = genreCategoryId
    ? getGenrePageRail(genrePageQuery.data, railId)
    : getAppContentRail({
        appContent: appContentQuery.data,
        railId,
        sectionRoute,
      });
  const isPending = genreCategoryId
    ? genrePageQuery.isPending
    : appContentQuery.isPending;

  const handleClose = () => {
    router.back();
  };

  const handleErrorAction = useErrorAction({ onCancel: handleClose });

  const handleTilePress = (selectedRail: ContentRail, item: ContentItem) => {
    handleRailItemPress(selectedRail, item, {
      onDirectVod: (vodItem) =>
        void openVodAsset({ id: vodItem.id, title: vodItem.title }),
      onItem: (selectedItem) => {
        const showId = getSeriesShowId(selectedItem);

        // A series item opens its show page, also as a sibling route.
        if (showId) {
          router.navigate(`../show/${showId}`);
          return;
        }

        if (getContentPlaybackType(selectedItem) === "vod") {
          // A sibling route, so the details page opens in the tab View All sits in.
          router.navigate(`../watch/${selectedItem.id}`);
          return;
        }

        router.push({
          params: { id: selectedItem.id, title: selectedItem.title },
          pathname: "/player/vod/[id]",
        });
      },
    });
  };

  if (isPending) {
    return <ContentGridSkeleton onClose={handleClose} />;
  }

  if (!rail) {
    return (
      <ErrorFullScreen
        code={errorCodes.contentUnavailable}
        onAction={handleErrorAction}
      />
    );
  }

  return (
    <PagedContentGrid
      onClose={handleClose}
      onTilePress={handleTilePress}
      rail={rail}
    />
  );
}
