import type { ContentItem } from "@bfbs/common-sdk";
import { View, type ViewStyle } from "react-native";
import { Text } from "@/components";
import { ContentTile } from "@/features/content-rails/components/content-tile/content-tile";
import { ContentTileSkeleton } from "@/features/content-rails/components/content-tile-skeleton/content-tile-skeleton";
import { toVodTile } from "@/features/content-rails/utils/to-vod-tile";

const EMPTY_MESSAGE = "Nothing related to this title yet.";
const ERROR_MESSAGE = "We couldn't load related titles.";
const SKELETON_ROWS = 2;

function RelatedMessage({ children }: { children: string }) {
  return (
    <View className="items-center py-8">
      <Text
        className="text-[14px] text-transparent-white-50"
        testID="related-grid-message"
        weight="normal"
      >
        {children}
      </Text>
    </View>
  );
}

/** Related grid shared by both layouts: its own loading, empty and error states. */
export function RelatedGrid({
  className,
  columnGap,
  columns,
  isError,
  isLoading,
  items,
  onSelect,
}: {
  className: string;
  columnGap: number;
  columns: number;
  isError: boolean;
  isLoading: boolean;
  items: ContentItem[];
  onSelect: (item: ContentItem) => void;
}) {
  // Percent cells let the layout resize tiles with the rotate, not after JS.
  // Each cell pads half the gap, and the grid pulls its edges back out.
  const gridStyle = { marginHorizontal: -columnGap / 2 };
  const cellStyle: ViewStyle = {
    paddingHorizontal: columnGap / 2,
    width: `${100 / columns}%`,
  };

  if (isLoading) {
    const skeletonKeys = Array.from(
      { length: columns * SKELETON_ROWS },
      (_, index) => `related-skeleton-${index}`,
    );

    return (
      <View
        accessibilityLabel="Loading related titles"
        accessibilityRole="progressbar"
        className={className}
        style={gridStyle}
        testID="related-grid-loading"
      >
        {skeletonKeys.map((key) => (
          <View key={key} style={cellStyle}>
            <ContentTileSkeleton width="100%" />
          </View>
        ))}
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <RelatedMessage>{isError ? ERROR_MESSAGE : EMPTY_MESSAGE}</RelatedMessage>
    );
  }

  return (
    <View className={className} style={gridStyle} testID="related-grid">
      {items.map((item) => (
        <View key={item.id} style={cellStyle}>
          <ContentTile
            onPress={() => onSelect(item)}
            tile={toVodTile(item)}
            width="100%"
          />
        </View>
      ))}
    </View>
  );
}
