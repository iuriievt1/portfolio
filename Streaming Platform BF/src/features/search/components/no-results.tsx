import {
  ContentCategoryTemplate,
  type ContentItem,
  type ContentRail as ContentRailPlacement,
} from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Keyboard, ScrollView, View } from "react-native";

import { Text } from "@/components";
import { ContentRail } from "@/features/content-rails/components/content-rail/content-rail";
import { ContentRailSkeleton } from "@/features/content-rails/components/content-rail-skeleton/content-rail-skeleton";
import type { ChannelRailTile } from "@/features/content-rails/types";
import { ChannelsRail, type LiveChannel } from "@/features/live-channels";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { reportError } from "@/infra/error";
import { pickChannelLogoUrl } from "@/utils/media";
import {
  prepareSearchResultItems,
  type SearchResultDestination,
} from "../search-result-items";
import {
  SEARCH_RECOMMENDATION_LIMIT,
  topSearchesQueryOptions,
} from "../top-searches";

const TOP_SEARCH_TITLE = "Top Search";
const CHANNELS_TITLE = "Channels";

type NoResultsProps = {
  channels: LiveChannel[];
  hasSearched: boolean;
  isChannelsLoading: boolean;
  onChannelPress: (channelId: string) => void;
  onRecommendationPress: (destination: SearchResultDestination) => void;
};

function createTopSearchRail(items: ContentItem[]): ContentRailPlacement {
  return {
    category: {
      id: "search-top-searches",
      name: TOP_SEARCH_TITLE,
      type: "search",
    },
    contentDisplay: { maxItems: SEARCH_RECOMMENDATION_LIMIT },
    display: { seeAllPosition: "none" },
    items,
    metadata: { count: items.length, total: items.length },
    template: ContentCategoryTemplate.SIXTEEN_BY_NINE_STANDARD,
  };
}

function createChannelTiles(channels: LiveChannel[]): ChannelRailTile[] {
  return channels.slice(0, SEARCH_RECOMMENDATION_LIMIT).map((channel) => {
    const imageUrl = pickChannelLogoUrl(channel.media);

    return {
      channel,
      id: channel.id,
      ...(imageUrl
        ? { media: { contentFit: "contain" as const, url: imageUrl } }
        : {}),
      name: channel.name,
    };
  });
}

/** Default Search recommendations shown before a query and after no results. */
export function NoResults({
  channels,
  hasSearched,
  isChannelsLoading,
  onChannelPress,
  onRecommendationPress,
}: NoResultsProps) {
  const { isLandscape, isTablet } = useDeviceLayout();
  const topSearches = useQuery(topSearchesQueryOptions());
  const topSearchRail = createTopSearchRail(topSearches.data?.items ?? []);
  const channelTiles = createChannelTiles(channels);
  const topSearchClassName = hasSearched ? "mt-6" : "mt-4";

  useEffect(() => {
    if (!topSearches.error) {
      return;
    }

    reportError(topSearches.error, {
      tags: { area: "search", operation: "get_top_searches" },
    });
  }, [topSearches.error]);

  function openTopSearch(_rail: ContentRailPlacement, item: ContentItem) {
    const recommendation = prepareSearchResultItems({
      channels,
      items: [item],
      nowMs: Date.now(),
    })[0];

    if (recommendation) {
      onRecommendationPress(recommendation.destination);
    }
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="pb-10"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      onTouchStart={Keyboard.dismiss}
      showsVerticalScrollIndicator={false}
      testID="search-no-results"
    >
      {hasSearched ? (
        <View className={isTablet ? "px-10 pt-6" : "px-3 pt-6"}>
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="header"
            className="text-[13px] leading-[22px] text-white"
          >
            Sorry, we can’t find what you’re looking for.
          </Text>
        </View>
      ) : null}

      {topSearches.isLoading ? (
        <ContentRailSkeleton
          className={topSearchClassName}
          isLandscape={isLandscape}
          isTablet={isTablet}
          size="standard"
          title={TOP_SEARCH_TITLE}
        />
      ) : null}

      {!topSearches.isLoading && topSearchRail.items?.length ? (
        <ContentRail
          className={topSearchClassName}
          isLandscape={isLandscape}
          isTablet={isTablet}
          memoryKey="search:no-results:top-searches"
          onTilePress={openTopSearch}
          rail={topSearchRail}
        />
      ) : null}
      <ChannelsRail
        className="mt-8"
        isLandscape={isLandscape}
        isLoading={isChannelsLoading}
        isTablet={isTablet}
        memoryKey="search:no-results:channels"
        onTilePress={(channel) => onChannelPress(channel.id)}
        tiles={channelTiles}
        title={CHANNELS_TITLE}
      />
    </ScrollView>
  );
}
