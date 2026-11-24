import type { Channel, ContentItem, ContentRail } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Text } from "@/components";
import { GridHeader } from "@/features/content-rails/components/content-grid/grid-header";
import { useGridGeometry } from "@/features/content-rails/components/content-grid/use-content-grid";
import { PageRailsList } from "@/features/content-rails/components/page-rails-list/page-rails-list";
import {
  handleContentItemPress,
  handleRailItemPress,
} from "@/features/content-rails/content";
import { toPageRails } from "@/features/content-rails/utils/to-page-rails";
import { genrePageQueryOptions } from "@/features/genre-page/genre-page";
import { useLiveChannels } from "@/features/live-channels";
import { usePlaybackLauncher } from "@/features/video-player";
import { ErrorFullScreen, errorCodes, useErrorAction } from "@/infra/error";
import { theme } from "@/theme/theme";

/** Loads and renders a provider-configured Genre page. */
export function GenrePageScreen() {
  const router = useRouter();
  const { categoryId, sectionSlug } = useLocalSearchParams<{
    categoryId?: string;
    sectionSlug?: string;
  }>();
  const pageQuery = useQuery({
    ...genrePageQueryOptions(categoryId ?? ""),
    enabled: Boolean(categoryId),
  });
  const liveState = useLiveChannels();
  const { gridPadding, header: headerMetrics, paddingTop } = useGridGeometry();
  const { openLiveChannel, openVodAsset } = usePlaybackLauncher();
  const rails = toPageRails(pageQuery.data?.rails ?? [], liveState);
  const handleBack = () => router.back();
  const handleErrorAction = useErrorAction({
    onCancel: handleBack,
    onRetry: () => void pageQuery.refetch(),
  });

  const openCategory = (destinationCategoryId: string) => {
    router.push(
      sectionSlug
        ? {
            params: { categoryId: destinationCategoryId, sectionSlug },
            pathname: "/[sectionSlug]/genre/[categoryId]",
          }
        : {
            params: { categoryId: destinationCategoryId },
            pathname: "/genre/[categoryId]",
          },
    );
  };

  const openChannel = (channel: Channel) => {
    router.push(
      sectionSlug
        ? {
            params: { channelId: channel.id, sectionSlug },
            pathname: "/[sectionSlug]/channel/[channelId]",
          }
        : {
            params: { channelId: channel.id },
            pathname: "/channel/[channelId]",
          },
    );
  };

  const openShow = (showId: string) => {
    router.push(
      sectionSlug
        ? {
            params: { sectionSlug, showId },
            pathname: "/[sectionSlug]/show/[showId]",
          }
        : { params: { showId }, pathname: "/show/[showId]" },
    );
  };

  const openVod = (item: ContentItem) => {
    router.push(
      sectionSlug
        ? {
            params: { assetId: item.id, sectionSlug },
            pathname: "/[sectionSlug]/watch/[assetId]",
          }
        : { params: { assetId: item.id }, pathname: "/watch/[assetId]" },
    );
  };

  const handleContentTilePress = (rail: ContentRail, item: ContentItem) => {
    handleRailItemPress(rail, item, {
      onDirectVod: (vodItem) =>
        void openVodAsset({ id: vodItem.id, title: vodItem.title }),
      onItem: (selectedItem) =>
        handleContentItemPress(selectedItem, liveState.channels, {
          onCategory: openCategory,
          onChannel: openChannel,
          onLive: (channelId) => void openLiveChannel(channelId),
          onShow: openShow,
          onVod: openVod,
        }),
    });
  };

  if (categoryId && pageQuery.isPending) {
    return (
      <View
        accessibilityLabel="Genre page loading"
        accessibilityRole="progressbar"
        className="flex-1 items-center justify-center bg-dark-slate-blue"
        testID="genre-page-loading"
      >
        <ActivityIndicator color={theme.colors.white} size="large" />
      </View>
    );
  }

  if (pageQuery.isError || !pageQuery.data) {
    return (
      <ErrorFullScreen
        actionLabels={{ refresh: "Retry" }}
        code={errorCodes.unexpected}
        onAction={handleErrorAction}
        supportedActions={["refresh", "back"]}
      />
    );
  }

  const header = (
    <View style={{ paddingTop }}>
      <GridHeader
        focusBackOnMount
        gridPadding={gridPadding}
        metrics={headerMetrics}
        onClose={handleBack}
        showTitleBlock={false}
      />
    </View>
  );

  if (rails.length === 0) {
    return (
      <View className="flex-1 bg-dark-slate-blue">
        {header}
        <Text
          className="pt-8 text-[18px] text-oatmeal"
          style={{ paddingHorizontal: gridPadding }}
          testID="genre-page-empty"
        >
          There is no content available for this genre yet.
        </Text>
      </View>
    );
  }

  const handleViewAllPress = (rail: ContentRail) => {
    router.push(
      sectionSlug
        ? {
            params: {
              genreCategoryId: categoryId,
              railId: rail.category.id,
              sectionSlug,
            },
            pathname: "/[sectionSlug]/view-all/[railId]",
          }
        : {
            params: { genreCategoryId: categoryId, railId: rail.category.id },
            pathname: "/view-all/[railId]",
          },
    );
  };

  return (
    <PageRailsList
      listProps={{ ListHeaderComponent: header }}
      onChannelPress={openChannel}
      onLiveTilePress={(channel) => void openLiveChannel(channel.id)}
      onContentTilePress={handleContentTilePress}
      onViewAllPress={handleViewAllPress}
      railMemoryScope={`genre:${categoryId}`}
      rails={rails}
    />
  );
}
