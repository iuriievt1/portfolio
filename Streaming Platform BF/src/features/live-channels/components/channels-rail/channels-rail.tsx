import { useState } from "react";
import { FlatList, type ListRenderItemInfo, View } from "react-native";

import { ContentRailSkeleton } from "@/features/content-rails/components/content-rail-skeleton/content-rail-skeleton";
import { RailTitle } from "@/features/content-rails/components/rail-title/rail-title";
import { useRailScrollMemory } from "@/features/content-rails/hooks/use-rail-scroll-memory";
import type { ChannelRailTile } from "@/features/content-rails/types";
import {
  getTileWidth,
  TILE_VARIANT,
  type TilePresentation,
} from "@/features/content-rails/utils/tile-metrics";
import type { LiveChannel } from "@/features/live-channels/types";
import { ChannelTile } from "./channel-tile";

const DEFAULT_TITLE = "Channels";
const INITIAL_TILE_COUNT = 6;
const DEFAULT_PRESENTATION: TilePresentation = {
  size: "standard",
  variant: TILE_VARIANT.SQUARE_CARD,
};

interface ChannelsRailProps {
  isLoading: boolean;
  isTablet: boolean;
  memoryKey: string;
  tiles: ChannelRailTile[];
  className?: string;
  isLandscape?: boolean;
  onTilePress?: (channel: LiveChannel) => void;
  presentation?: TilePresentation;
  title?: string;
}

/** Renders provider channels using the rail's requested tile presentation. */
export function ChannelsRail({
  isLoading,
  isTablet,
  memoryKey,
  tiles,
  className = "",
  isLandscape = false,
  onTilePress,
  presentation = DEFAULT_PRESENTATION,
  title = DEFAULT_TITLE,
}: ChannelsRailProps) {
  const { size, variant } = presentation;
  const { hasSavedOffset, initialOffset, saveOffset } =
    useRailScrollMemory(memoryKey);
  /** An image that will not load falls back to the name, like a missing one. */
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(
    new Set(),
  );

  if (isLoading) {
    return (
      <ContentRailSkeleton
        className={className}
        isLandscape={isLandscape}
        isTablet={isTablet}
        reservesLabelBlock={false}
        size={size}
        title={title}
        variant={variant}
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
  const renderTile = ({ item }: ListRenderItemInfo<ChannelRailTile>) => {
    const media =
      item.media && !failedImages.has(item.media.url) ? item.media : undefined;

    return (
      <ChannelTile
        {...(media ? { media } : {})}
        name={item.name}
        onImageError={(failedUrl) =>
          setFailedImages((failed) => new Set(failed).add(failedUrl))
        }
        onPress={onTilePress ? () => onTilePress(item.channel) : undefined}
        variant={variant}
        width={tileWidth}
      />
    );
  };

  return (
    <View className={className}>
      <RailTitle isTablet={isTablet}>{title}</RailTitle>
      <FlatList
        contentContainerClassName={`gap-4 ${isTablet ? "px-10" : "px-3"}`}
        data={tiles}
        horizontal
        initialNumToRender={INITIAL_TILE_COUNT}
        keyExtractor={(tile) => tile.id}
        onMomentumScrollEnd={saveOffset}
        onScrollEndDrag={saveOffset}
        renderItem={renderTile}
        showsHorizontalScrollIndicator={false}
        {...(hasSavedOffset
          ? { contentOffset: { x: initialOffset, y: 0 } }
          : {})}
        {...(isTablet ? {} : { className: "pt-2" })}
      />
    </View>
  );
}
