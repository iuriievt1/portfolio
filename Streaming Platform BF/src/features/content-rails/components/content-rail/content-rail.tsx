import type {
  ContentItem,
  ContentRail as RailPlacement,
} from "@bfbs/common-sdk";
import { FlatList, View } from "react-native";
import { ContentTile } from "@/features/content-rails/components/content-tile/content-tile";
import { RailTitle } from "@/features/content-rails/components/rail-title/rail-title";
import { ViewAllTile } from "@/features/content-rails/components/view-all-tile/view-all-tile";
import { useRailScrollMemory } from "@/features/content-rails/hooks/use-rail-scroll-memory";
import {
  getDisplayedTiles,
  isContinueWatchingRail,
  isRankedRail,
  shouldShowViewAll,
} from "@/features/content-rails/utils/rail-content";
import {
  getTileAspectRatio,
  getTileFormFactor,
  getTilePresentation,
  getTileWidth,
} from "@/features/content-rails/utils/tile-metrics";
import { toRailTile } from "@/features/content-rails/utils/to-rail-tile";
import { toVodTile } from "@/features/content-rails/utils/to-vod-tile";
import { useListingTimeZone } from "@/features/my-bfbs";
import { getContinueWatching } from "@/features/watch-details/utils/watch-details-metadata";

const INITIAL_TILE_COUNT = 6;
const PRIORITY_TILE_COUNT = 4;

interface ContentRailProps {
  rail: RailPlacement;
  isTablet: boolean;
  isLandscape?: boolean;
  className?: string;
  isPriority?: boolean;
  memoryKey?: string;
  onTilePress?: (rail: RailPlacement, tile: ContentItem) => void;
  onViewAllPress?: (rail: RailPlacement) => void;
}

/** Renders a horizontally scrolling SDK content rail and remembers its offset. */
export function ContentRail({
  rail,
  isTablet,
  isLandscape = false,
  className = "",
  isPriority = false,
  memoryKey = rail.category.id,
  onTilePress,
  onViewAllPress,
}: ContentRailProps) {
  const timeZone = useListingTimeZone();
  const { size, variant } = getTilePresentation(rail.template);
  const formFactor = getTileFormFactor({ isLandscape, isTablet });
  const tileAspectRatio = getTileAspectRatio(variant, { formFactor, size });
  const items = getDisplayedTiles(rail);
  const isContinueWatching = isContinueWatchingRail(rail);
  const tiles = items.flatMap((item) => {
    // Continue Watching is all VOD; a channel would make an episode a live tile.
    const tile = isContinueWatching
      ? toVodTile(item)
      : toRailTile(item, timeZone);

    return tile ? [{ item, tile }] : [];
  });
  const showViewAll = shouldShowViewAll(rail);
  const showsRank = isRankedRail(rail);
  const tileWidth = getTileWidth({ isLandscape, isTablet, size, variant });
  const { hasSavedOffset, initialOffset, saveOffset } =
    useRailScrollMemory(memoryKey);

  if (tiles.length === 0) {
    return null;
  }

  return (
    <View className={className}>
      <RailTitle isLandscape={isLandscape} isTablet={isTablet}>
        {rail.category.name}
      </RailTitle>
      <FlatList
        contentContainerClassName={isTablet ? "gap-4 px-10" : "gap-2 px-3"}
        data={tiles}
        horizontal
        initialNumToRender={INITIAL_TILE_COUNT}
        keyExtractor={({ item }) => item.id}
        ListFooterComponent={
          showViewAll ? (
            <ViewAllTile
              aspectRatio={tileAspectRatio}
              onPress={onViewAllPress ? () => onViewAllPress(rail) : undefined}
              variant={variant}
              width={tileWidth}
            />
          ) : null
        }
        onMomentumScrollEnd={saveOffset}
        onScrollEndDrag={saveOffset}
        renderItem={({ item: { item, tile }, index }) => (
          <ContentTile
            aspectRatio={tileAspectRatio}
            isPriority={isPriority && index < PRIORITY_TILE_COUNT}
            onPress={onTilePress ? () => onTilePress(rail, item) : undefined}
            progress={
              isContinueWatching
                ? getContinueWatching(item)?.progress
                : undefined
            }
            rank={showsRank ? index + 1 : undefined}
            size={size}
            tile={tile}
            variant={variant}
            width={tileWidth}
          />
        )}
        showsHorizontalScrollIndicator={false}
        testID="content-rail-scroll"
        {...(hasSavedOffset
          ? { contentOffset: { x: initialOffset, y: 0 } }
          : {})}
        {...(isTablet ? {} : { className: "pt-2" })}
      />
    </View>
  );
}
