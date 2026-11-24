import type { ContentItem, ContentRail } from "@bfbs/common-sdk";
import { Animated, FlatList, View } from "react-native";

import { Button, ScreenBackground, Text } from "@/components";
import {
  GRID_LIST_MARGIN_TOP,
  GRID_PADDING_BOTTOM,
} from "@/features/content-rails/components/content-grid/grid-metrics";
import { GridShell } from "@/features/content-rails/components/content-grid/grid-shell";
import { useContentGrid } from "@/features/content-rails/components/content-grid/use-content-grid";
import { ContentTile } from "@/features/content-rails/components/content-tile/content-tile";
import { ContentTileSkeleton } from "@/features/content-rails/components/content-tile-skeleton/content-tile-skeleton";
import {
  getRailItemLimit,
  getRenderableContentItems,
  isRankedRail,
} from "@/features/content-rails/utils/rail-content";
import {
  getTilePresentation,
  TILE_VARIANT,
} from "@/features/content-rails/utils/tile-metrics";
import { toVodTile } from "@/features/content-rails/utils/to-vod-tile";
import { usePulseOpacity } from "@/hooks/use-pulse-opacity";

const NEXT_PAGE_ERROR_MESSAGE = "We couldn't load more titles.";

function NextPageSkeletons({
  columnGap,
  columns,
  tileWidth,
}: {
  columnGap: number;
  columns: number;
  tileWidth: number;
}) {
  const opacity = usePulseOpacity();
  const skeletonKeys = Array.from(
    { length: columns },
    (_, index) => `next-page-${index}`,
  );

  return (
    <Animated.View
      accessibilityLabel="Loading more titles"
      accessibilityRole="progressbar"
      className="flex-row"
      style={{ gap: columnGap, opacity }}
      testID="content-grid-next-page-loading"
    >
      {skeletonKeys.map((key) => (
        <ContentTileSkeleton key={key} width={tileWidth} />
      ))}
    </Animated.View>
  );
}

export type GridPagination = {
  hasError: boolean;
  isLoadingNextPage: boolean;
  items: ContentItem[];
  onEndReached: () => void;
  onRetry: () => void;
};

function GridFooter({
  columnGap,
  columns,
  pagination,
  tileWidth,
}: {
  columnGap: number;
  columns: number;
  pagination: GridPagination | undefined;
  tileWidth: number;
}) {
  if (!pagination) {
    return null;
  }

  if (pagination.isLoadingNextPage) {
    return (
      <NextPageSkeletons
        columnGap={columnGap}
        columns={columns}
        tileWidth={tileWidth}
      />
    );
  }

  if (!pagination.hasError) {
    return null;
  }

  return (
    <View className="items-center pt-6">
      <Text className="text-[14px] text-transparent-white-50" weight="normal">
        {NEXT_PAGE_ERROR_MESSAGE}
      </Text>
      <Button
        className="mt-3"
        onPress={pagination.onRetry}
        testID="content-grid-next-page-retry"
      >
        Try again
      </Button>
    </View>
  );
}

interface ContentGridProps {
  rail: ContentRail;
  onClose?: (() => void) | undefined;
  onTilePress?: (rail: ContentRail, tile: ContentItem) => void;
  pagination?: GridPagination | undefined;
}

/** A rail's items as a full page. */
export function ContentGrid({
  rail,
  onClose,
  onTilePress,
  pagination,
}: ContentGridProps) {
  const items = getRenderableContentItems(
    rail,
    pagination ? pagination.items : (rail.items ?? []),
  );
  const showsRank = isRankedRail(rail);
  const presentation = getTilePresentation(rail.template);
  const variant =
    presentation.variant === TILE_VARIANT.VERTICAL
      ? TILE_VARIANT.VERTICAL
      : TILE_VARIANT.LANDSCAPE;
  const {
    columnGap,
    columns,
    coverOpacity,
    endReachedThreshold,
    estimatedOffsetY,
    gridPadding,
    header,
    initialNumToRender,
    listRef,
    onContentSizeChange,
    onLayout,
    onMomentumScrollEnd,
    onScrollBeginDrag,
    onScrollEndDrag,
    paddingTop,
    rowGap,
    tileWidth,
  } = useContentGrid({
    itemCount: items.length,
    railId: rail.category.id,
    railItemLimit: getRailItemLimit(rail),
  });

  return (
    <View className="flex-1">
      <GridShell
        gridPadding={gridPadding}
        metrics={header}
        onClose={onClose}
        paddingTop={paddingTop}
        title={rail.category.name}
      >
        <FlatList
          ListFooterComponent={
            <GridFooter
              columnGap={columnGap}
              columns={columns}
              pagination={pagination}
              tileWidth={tileWidth}
            />
          }
          columnWrapperStyle={{ gap: columnGap }}
          contentContainerStyle={{
            paddingBottom: GRID_PADDING_BOTTOM,
            paddingHorizontal: gridPadding,
            rowGap,
          }}
          contentOffset={{ x: 0, y: estimatedOffsetY }}
          data={items}
          initialNumToRender={initialNumToRender}
          key={`grid-${columns}`}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          onContentSizeChange={onContentSizeChange}
          onEndReached={pagination?.onEndReached}
          onEndReachedThreshold={endReachedThreshold}
          onLayout={onLayout}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          ref={listRef}
          renderItem={({ index, item }) => (
            <ContentTile
              onPress={onTilePress ? () => onTilePress(rail, item) : undefined}
              rank={showsRank ? index + 1 : undefined}
              reservesLabelBlock={false}
              tile={toVodTile(item)}
              variant={variant}
              width={tileWidth}
            />
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={{ marginTop: GRID_LIST_MARGIN_TOP }}
          testID="content-grid-scroll"
        />
      </GridShell>
      <Animated.View
        className="absolute inset-0 bg-dark-slate-blue"
        pointerEvents="none"
        style={{ opacity: coverOpacity }}
        testID="content-grid-scroll-cover"
      >
        <ScreenBackground artwork={false} />
      </Animated.View>
    </View>
  );
}
