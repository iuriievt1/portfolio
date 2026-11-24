import { useMemo } from "react";
import { FlatList, View } from "react-native";

import { ContentRailSkeleton } from "@/features/content-rails/components/content-rail-skeleton/content-rail-skeleton";
import { ContentTile } from "@/features/content-rails/components/content-tile/content-tile";
import { RailTitle } from "@/features/content-rails/components/rail-title/rail-title";
import { useRailScrollMemory } from "@/features/content-rails/hooks/use-rail-scroll-memory";
import {
  getTileWidth,
  TILE_VARIANT,
  type TilePresentation,
} from "@/features/content-rails/utils/tile-metrics";
import { useListingTimeZone } from "@/features/my-bfbs";
import { usePlaybackLauncher } from "@/features/video-player";
import { toLiveTile } from "../to-live-tile";
import type { LiveChannel } from "../types";

const DEFAULT_TITLE = "Live Channels";
const DEFAULT_PRESENTATION: TilePresentation = {
  size: "large",
  variant: TILE_VARIANT.LANDSCAPE,
};
const INITIAL_TILE_COUNT = 6;
const PRIORITY_TILE_COUNT = 4;

interface LiveChannelsRailProps {
  channels: LiveChannel[];
  isLoading: boolean;
  isTablet: boolean;
  className?: string;
  isLandscape?: boolean;
  isPriority?: boolean;
  memoryKey?: string;
  onTilePress?: (channel: LiveChannel) => void;
  presentation?: TilePresentation;
  title?: string;
}

/** Renders SDK live channels as a horizontal rail of live programme tiles. */
export function LiveChannelsRail({
  channels,
  isLoading,
  isTablet,
  className = "",
  isLandscape = false,
  isPriority = false,
  onTilePress,
  presentation = DEFAULT_PRESENTATION,
  title = DEFAULT_TITLE,
  memoryKey = `live-channels:${title}`,
}: LiveChannelsRailProps) {
  const { size, variant } = presentation;
  const timeZone = useListingTimeZone();
  const tiles = useMemo(
    () =>
      channels.map((channel) => ({
        channel,
        tile: toLiveTile(channel, timeZone),
      })),
    [channels, timeZone],
  );
  const { hasSavedOffset, initialOffset, saveOffset } =
    useRailScrollMemory(memoryKey);
  const { openLiveChannel } = usePlaybackLauncher();

  // Only true on first load, so this cannot flip back once it has content.
  if (isLoading) {
    return (
      <ContentRailSkeleton
        className={className}
        isLandscape={isLandscape}
        isTablet={isTablet}
        size={size}
        title={title}
      />
    );
  }

  if (tiles.length === 0) {
    return null;
  }

  const tileWidth = getTileWidth({
    isLandscape,
    isTablet,
    size,
    variant,
  });

  const handleTilePress = (channel: LiveChannel) => {
    if (onTilePress) {
      onTilePress(channel);
      return;
    }

    void openLiveChannel(channel.id);
  };

  return (
    <View className={className}>
      <RailTitle isLandscape={isLandscape} isTablet={isTablet}>
        {title}
      </RailTitle>
      <FlatList
        contentContainerClassName={isTablet ? "gap-4 px-10" : "gap-2 px-3"}
        data={tiles}
        horizontal
        initialNumToRender={INITIAL_TILE_COUNT}
        keyExtractor={({ tile }) => tile.id}
        onMomentumScrollEnd={saveOffset}
        onScrollEndDrag={saveOffset}
        renderItem={({ item, index }) => (
          <ContentTile
            isPriority={isPriority && index < PRIORITY_TILE_COUNT}
            onPress={() => handleTilePress(item.channel)}
            size={size}
            variant={variant}
            tile={item.tile}
            width={tileWidth}
          />
        )}
        showsHorizontalScrollIndicator={false}
        {...(hasSavedOffset
          ? { contentOffset: { x: initialOffset, y: 0 } }
          : {})}
        {...(isTablet ? {} : { className: "pt-2" })}
      />
    </View>
  );
}
