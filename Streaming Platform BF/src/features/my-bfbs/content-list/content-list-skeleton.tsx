import { View } from "react-native";
import {
  getTileAspectRatio,
  TILE_CORNER_RADIUS,
} from "@/features/content-rails";

const ROW_COUNT = 5;
const ROW_KEYS = Array.from(
  { length: ROW_COUNT },
  (_, index) => `skeleton-row-${index}`,
);

type ContentListSkeletonProps = {
  artworkWidth: number;
};

// Grey placeholder rows in the shape of the cards, shown while the list loads.
export function ContentListSkeleton({
  artworkWidth,
}: ContentListSkeletonProps) {
  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      className="gap-4"
      testID="content-list-skeleton"
    >
      {ROW_KEYS.map((key) => (
        <View className="flex-row items-center gap-4" key={key}>
          <View
            className="bg-medium-slate-blue"
            style={{
              aspectRatio: getTileAspectRatio(),
              borderRadius: TILE_CORNER_RADIUS,
              width: artworkWidth,
            }}
          />
          <View className="flex-1 gap-2">
            <View className="h-[12px] w-3/4 rounded bg-transparent-white-10" />
            <View className="h-[12px] w-1/2 rounded bg-transparent-white-10" />
          </View>
        </View>
      ))}
    </View>
  );
}
