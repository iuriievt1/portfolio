import type { Channel, ContentItem, ContentRail } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  type AppSectionRoute,
  appContentQueryOptions,
  getAppContentSection,
} from "@/features/content-rails/app-content";
import {
  handleContentItemPress,
  handleRailItemPress,
} from "@/features/content-rails/content";
import { isContinueWatchingRail } from "@/features/content-rails/utils/rail-content";
import { toPageRails } from "@/features/content-rails/utils/to-page-rails";
import type { LiveChannel } from "@/features/live-channels";
import { useLiveChannels } from "@/features/live-channels";
import { TopNavigationHeader } from "@/features/top-navigation/components/top-navigation-header";
import { usePlaybackLauncher } from "@/features/video-player";
import { useAppContentRefresh } from "./use-app-content-refresh";

type UseAppContentPageOptions = {
  onChannelPress?: (channel: Channel) => void;
  onShowPress?: (showId: string) => void;
  onVodAssetPress?: (item: ContentItem) => void;
  onViewAllPress?: (rail: ContentRail) => void;
};

/** Page rails, loading state and tap handlers. */
export function useAppContentPage(
  route: AppSectionRoute,
  options?: UseAppContentPageOptions,
) {
  const router = useRouter();
  useAppContentRefresh(route);
  const { openLiveChannel: launchLiveChannel, openVodAsset } =
    usePlaybackLauncher();
  const { data: appContent, isPending } = useQuery(appContentQueryOptions);
  const { channels, error, isLoading } = useLiveChannels();
  const section = getAppContentSection(appContent, route);
  const rails = toPageRails(section?.rails ?? [], {
    channels,
    error,
    isLoading,
  });

  const openLiveChannel = (channelId: string) => {
    void launchLiveChannel(channelId);
  };

  const openShow = (showId: string) => {
    if (options?.onShowPress) {
      options.onShowPress(showId);
      return;
    }

    router.navigate({
      params: { showId },
      pathname: "/show/[showId]",
    });
  };

  const handleChannelPress = (channel: Channel) => {
    if (options?.onChannelPress) {
      options.onChannelPress(channel);
      return;
    }

    router.navigate({
      params: { channelId: channel.id },
      pathname: "/channel/[channelId]",
    });
  };

  const handleCategoryPress = (categoryId: string) => {
    if (route === "/") {
      router.navigate({
        params: { categoryId },
        pathname: "/genre/[categoryId]",
      });
      return;
    }

    router.navigate({
      params: { categoryId, sectionSlug: route.slice(1) },
      pathname: "/[sectionSlug]/genre/[categoryId]",
    });
  };

  const handleContentTilePress = (rail: ContentRail, item: ContentItem) => {
    // Continue Watching resumes in the player.
    if (isContinueWatchingRail(rail)) {
      void openVodAsset({ id: item.id, title: item.title });
      return;
    }

    handleRailItemPress(rail, item, {
      onDirectVod: (vodItem) => {
        void openVodAsset({ id: vodItem.id, title: vodItem.title });
      },
      onItem: (selectedItem) =>
        handleContentItemPress(selectedItem, channels, {
          onCategory: handleCategoryPress,
          onChannel: handleChannelPress,
          onLive: openLiveChannel,
          onShow: openShow,
          onVod: (vodItem) => {
            if (options?.onVodAssetPress) {
              options.onVodAssetPress(vodItem);
              return;
            }

            router.navigate({
              params: { assetId: vodItem.id },
              pathname: "/watch/[assetId]",
            });
          },
        }),
    });
  };

  const handleLiveTilePress = (channel: LiveChannel) => {
    openLiveChannel(channel.id);
  };

  const handleViewAllPress = (rail: ContentRail) => {
    if (options?.onViewAllPress) {
      options.onViewAllPress(rail);
      return;
    }

    router.navigate({
      params: { railId: rail.category.id, sectionRoute: route },
      pathname: "/view-all/[railId]",
    });
  };

  return {
    isPending,
    listProps: { ListHeaderComponent: TopNavigationHeader },
    onChannelPress: handleChannelPress,
    onLiveTilePress: handleLiveTilePress,
    onContentTilePress: handleContentTilePress,
    onViewAllPress: handleViewAllPress,
    railMemoryScope: route,
    rails,
  };
}
