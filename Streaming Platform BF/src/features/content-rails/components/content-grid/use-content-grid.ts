import type { ContentItem } from "@bfbs/common-sdk";
import { useFocusEffect } from "expo-router";
import { useRef } from "react";
import type {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  GRID_COLUMN_GAP,
  GRID_LIST_ROW_GAP,
  GRID_PADDING_BOTTOM,
  GRID_SIDE_PADDING,
  getGridHeaderMetrics,
  TABLET_GRID_COLUMN_GAP,
  TABLET_GRID_SIDE_PADDING,
} from "@/features/content-rails/components/content-grid/grid-metrics";
import { useGridScrollMemory } from "@/features/content-rails/hooks/use-rail-scroll-memory";
import { useScrollRestore } from "@/features/content-rails/hooks/use-scroll-restore";
import type { TileSize } from "@/features/content-rails/types";
import {
  getTileFormFactor,
  getTileWidth,
  TILE_ASPECT_RATIO,
  TILE_LABEL_BLOCK_HEIGHT,
} from "@/features/content-rails/utils/tile-metrics";
import { useDeviceLayout } from "@/hooks/use-device-layout";

const GRID_MIN_COLUMNS = 2;
/** Decides the column count. */
const GRID_TILE_SIZE: TileSize = "standard";
/** Half a screen of runway before the next page is asked for. */
const END_REACHED_THRESHOLD = 0.5;
const EXTRA_ROWS_TO_RENDER = 2;

/** Shared with the skeleton. */
export function useGridGeometry() {
  const insets = useSafeAreaInsets();
  const { height, isLandscape, isTablet, width } = useDeviceLayout();

  const columnGap = isTablet ? TABLET_GRID_COLUMN_GAP : GRID_COLUMN_GAP;
  const gridPadding = isTablet ? TABLET_GRID_SIDE_PADDING : GRID_SIDE_PADDING;
  const header = getGridHeaderMetrics(
    getTileFormFactor({ isLandscape, isTablet }),
  );
  const availableWidth = width - gridPadding * 2;

  const seedTileWidth = getTileWidth({
    isLandscape,
    isTablet,
    size: GRID_TILE_SIZE,
  });
  const columns = Math.max(
    GRID_MIN_COLUMNS,
    Math.floor((availableWidth + columnGap) / (seedTileWidth + columnGap)),
  );
  const tileWidth = Math.floor(
    (availableWidth - columnGap * (columns - 1)) / columns,
  );
  const tileHeight = tileWidth / TILE_ASPECT_RATIO + TILE_LABEL_BLOCK_HEIGHT;

  return {
    columnGap,
    columns,
    gridPadding,
    header,
    paddingTop: insets.top,
    rowGap: GRID_LIST_ROW_GAP,
    rowStride: tileHeight + GRID_LIST_ROW_GAP,
    tileHeight,
    tileWidth,
    estimatedViewportHeight: height - insets.top - header.height,
  };
}

/** Grid geometry and scrolling. */
export function useContentGrid({
  itemCount,
  railId,
  railItemLimit,
}: {
  itemCount: number;
  railId: string;
  railItemLimit: number;
}) {
  const { getSavedOffset, mountOffset, saveOffset } =
    useGridScrollMemory(railId);
  const {
    columnGap,
    columns,
    estimatedViewportHeight,
    gridPadding,
    header,
    paddingTop,
    rowGap,
    rowStride,
    tileHeight,
    tileWidth,
  } = useGridGeometry();

  const rowsAboveViewport =
    itemCount > railItemLimit ? Math.floor(railItemLimit / columns) : 0;
  /** Where the rail left off. */
  const railRowOffsetY = rowsAboveViewport * rowStride;

  const rowCount = Math.ceil(itemCount / columns);
  const estimatedContentHeight =
    rowCount * tileHeight +
    Math.max(0, rowCount - 1) * rowGap +
    GRID_PADDING_BOTTOM;
  const estimatedOffsetY =
    mountOffset ??
    Math.min(
      railRowOffsetY,
      Math.max(0, estimatedContentHeight - estimatedViewportHeight),
    );

  const listRef = useRef<FlatList<ContentItem>>(null);
  const viewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const { cancel, coverOpacity, isRestoring, start } = useScrollRestore();

  useFocusEffect(() => {
    const offsetY = getSavedOffset() ?? railRowOffsetY;

    if (offsetY <= 0) {
      return;
    }

    return start(() => {
      const viewportHeight = viewportHeightRef.current;
      const contentHeight = contentHeightRef.current;

      if (viewportHeight > 0 && contentHeight > 0) {
        listRef.current?.scrollToOffset({
          animated: false,
          offset: Math.min(
            offsetY,
            Math.max(0, contentHeight - viewportHeight),
          ),
        });
      }
    });
  });

  const onLayout = (event: LayoutChangeEvent) => {
    viewportHeightRef.current = event.nativeEvent.layout.height;
  };

  const onContentSizeChange = (_width: number, contentHeight: number) => {
    contentHeightRef.current = contentHeight;
  };

  /** Saves a finished gesture only. */
  const onScrollSettled = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isRestoring()) {
      saveOffset(event);
    }
  };

  const rowsToRender = Math.ceil(estimatedOffsetY / rowStride);

  return {
    columnGap,
    columns,
    coverOpacity,
    endReachedThreshold: END_REACHED_THRESHOLD,
    estimatedOffsetY,
    gridPadding,
    header,
    initialNumToRender: (rowsToRender + EXTRA_ROWS_TO_RENDER) * columns,
    listRef,
    onContentSizeChange,
    onLayout,
    onMomentumScrollEnd: onScrollSettled,
    onScrollBeginDrag: cancel,
    onScrollEndDrag: onScrollSettled,
    paddingTop,
    rowGap,
    tileWidth,
  };
}
