import type { ContentItem } from "@bfbs/common-sdk";
import { Animated, FlatList, View } from "react-native";

import { Button, Text } from "@/components";
import {
  GRID_PADDING_BOTTOM,
  GRID_SIDE_PADDING,
  TABLET_GRID_SIDE_PADDING,
} from "@/features/content-rails/components/content-grid/grid-metrics";
import { useGridGeometry } from "@/features/content-rails/components/content-grid/use-content-grid";
import { ContentTile } from "@/features/content-rails/components/content-tile/content-tile";
import { ContentTileSkeleton } from "@/features/content-rails/components/content-tile-skeleton/content-tile-skeleton";
import type { LiveChannel } from "@/features/live-channels";
import { useListingTimeZone } from "@/features/my-bfbs";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { usePulseOpacity } from "@/hooks/use-pulse-opacity";
import {
  prepareSearchResultItems,
  type SearchResultDestination,
  type SearchResultItem,
} from "../search-result-items";

const SEARCH_RESULTS_HEADING = "Search Results";
const SEARCH_RESULTS_ERROR = "We couldn't load your search results.";
const PHONE_SKELETON_COUNT = 6;
const TABLET_SKELETON_COUNT = 8;
const SKELETON_KEYS = [
  "search-skeleton-1",
  "search-skeleton-2",
  "search-skeleton-3",
  "search-skeleton-4",
  "search-skeleton-5",
  "search-skeleton-6",
  "search-skeleton-7",
  "search-skeleton-8",
] as const;

export type SearchResultsGridProps = {
  channels: LiveChannel[];
  error: unknown | null;
  isLoading: boolean;
  items: ContentItem[];
  nowMs?: number;
  onResultPress: (destination: SearchResultDestination) => void;
  onRetry: () => void;
  submittedQuery: string | null;
};

function ResultsHeading({ horizontalPadding }: { horizontalPadding: number }) {
  return (
    <Text
      accessibilityRole="header"
      className="mb-2 mt-6 text-[18px] leading-[22px] text-white"
      style={{ paddingHorizontal: horizontalPadding }}
      weight="bold"
    >
      {SEARCH_RESULTS_HEADING}
    </Text>
  );
}

function SearchResultsSkeleton({
  columnGap,
  columns,
  horizontalPadding,
  rowGap,
  tileWidth,
}: {
  columnGap: number;
  columns: number;
  horizontalPadding: number;
  rowGap: number;
  tileWidth: number;
}) {
  const opacity = usePulseOpacity();
  const count = columns === 2 ? PHONE_SKELETON_COUNT : TABLET_SKELETON_COUNT;

  return (
    <View className="flex-1">
      <ResultsHeading horizontalPadding={horizontalPadding} />
      <Animated.View
        accessibilityLabel="Loading search results"
        accessibilityRole="progressbar"
        className="flex-row flex-wrap"
        style={{
          columnGap,
          opacity,
          paddingHorizontal: horizontalPadding,
          rowGap,
        }}
        testID="search-results-loading"
      >
        {SKELETON_KEYS.slice(0, count).map((key) => (
          <ContentTileSkeleton key={key} width={tileWidth} />
        ))}
      </Animated.View>
    </View>
  );
}

/** Displays prepared search results without owning search or playback state. */
export function SearchResultsGrid({
  channels,
  error,
  isLoading,
  items,
  nowMs = Date.now(),
  onResultPress,
  onRetry,
  submittedQuery,
}: SearchResultsGridProps) {
  const { isTablet } = useDeviceLayout();
  const timeZone = useListingTimeZone();
  const { columnGap, columns, rowGap, tileWidth } = useGridGeometry();
  const horizontalPadding = isTablet
    ? TABLET_GRID_SIDE_PADDING
    : GRID_SIDE_PADDING;

  if (!submittedQuery) {
    return null;
  }

  if (isLoading) {
    return (
      <SearchResultsSkeleton
        columnGap={columnGap}
        columns={columns}
        horizontalPadding={horizontalPadding}
        rowGap={rowGap}
        tileWidth={tileWidth}
      />
    );
  }

  if (error) {
    return (
      <View
        accessibilityLiveRegion="polite"
        className="flex-1 items-center justify-center px-6"
        testID="search-results-error"
      >
        <Text
          accessibilityRole="alert"
          className="text-center text-[16px] leading-[22px] text-white"
          weight="semibold"
        >
          {SEARCH_RESULTS_ERROR}
        </Text>
        <Button
          className="mt-4"
          onPress={onRetry}
          testID="search-results-retry"
        >
          Try again
        </Button>
      </View>
    );
  }

  const results = prepareSearchResultItems({
    channels,
    items,
    nowMs,
    timeZone,
  });

  if (results.length === 0) {
    return null;
  }

  return (
    <View className="flex-1" testID="search-results">
      <ResultsHeading horizontalPadding={horizontalPadding} />
      <FlatList<SearchResultItem>
        columnWrapperStyle={{ gap: columnGap }}
        contentContainerStyle={{
          paddingBottom: GRID_PADDING_BOTTOM,
          paddingHorizontal: horizontalPadding,
          rowGap,
        }}
        data={results}
        key={`search-results-${columns}`}
        keyExtractor={(item) => item.key}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        numColumns={columns}
        renderItem={({ item }) => (
          <ContentTile
            onPress={() => onResultPress(item.destination)}
            reservesLabelBlock={false}
            tile={item.tile}
            width={tileWidth}
          />
        )}
        showsVerticalScrollIndicator={false}
        testID="search-results-scroll"
      />
    </View>
  );
}
