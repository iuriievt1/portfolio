import { Animated, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SkeletonBlock } from "@/features/watch-details/components/watch-details-skeleton/skeleton-block";
import {
  getTabletMetrics,
  getTextMaxWidth,
  HERO_SIZE_STYLE,
  RELATED_COLUMNS,
  RELATED_TILE_GAP,
} from "@/features/watch-details/components/watch-details-tablet/tablet-metrics";
import { usePulseOpacity } from "@/hooks/use-pulse-opacity";

const BUTTON_HEIGHT = 45;
const TAB_WIDTH = 116;
const TAB_HEIGHT = 32;

export function WatchDetailsTabletSkeleton({
  isLandscape,
}: {
  isLandscape: boolean;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const opacity = usePulseOpacity();
  const metrics = getTabletMetrics(isLandscape);

  const tileKeys = Array.from(
    { length: RELATED_COLUMNS },
    (_, index) => `tablet-skeleton-tile-${index}`,
  );

  return (
    <View className="flex-1 bg-dark-slate-blue" testID="watch-details-skeleton">
      <Animated.View style={{ opacity }}>
        <View>
          <View
            className="absolute right-0 top-0 bg-medium-slate-blue"
            style={HERO_SIZE_STYLE}
          />

          <View style={{ paddingTop: insets.top + metrics.backTopInset }}>
            <SkeletonBlock className="ml-[41px] h-5 w-16 rounded" />

            <View
              className="pl-[40px]"
              style={{ marginTop: metrics.contentTopGap }}
            >
              <SkeletonBlock className="h-[28px] w-1/2 rounded" />
              <SkeletonBlock className="mt-[18px] h-[30px] w-[108px] rounded-[2px]" />
              <SkeletonBlock
                className="h-[14px] w-[240px] rounded"
                style={{ marginTop: metrics.sectionGap }}
              />
              <View
                className="gap-2"
                style={{
                  marginTop: metrics.sectionGap,
                  maxWidth: getTextMaxWidth({ metrics, width }),
                }}
              >
                <SkeletonBlock className="h-[16px] rounded" />
                <SkeletonBlock className="h-[16px] w-2/3 rounded" />
              </View>
              <View
                className="flex-row"
                style={{ gap: 16, marginTop: metrics.blockGap }}
              >
                <SkeletonBlock
                  className="rounded-full"
                  style={{ height: BUTTON_HEIGHT, width: metrics.buttonWidth }}
                />
                <SkeletonBlock
                  className="rounded-full"
                  style={{ height: BUTTON_HEIGHT, width: metrics.buttonWidth }}
                />
              </View>
            </View>
          </View>
        </View>

        <View
          className="flex-row gap-4 pl-[40px]"
          style={{ marginTop: metrics.buttonsToTabsGap }}
        >
          <SkeletonBlock
            className="rounded"
            style={{ height: TAB_HEIGHT, width: TAB_WIDTH }}
          />
          <SkeletonBlock
            className="rounded"
            style={{ height: TAB_HEIGHT, width: TAB_WIDTH }}
          />
        </View>

        {/* Same percent cells as RelatedGrid, so tiles resize with the rotate. */}
        <View
          className="mt-4 flex-row flex-wrap gap-y-6 px-10"
          style={{ marginHorizontal: -RELATED_TILE_GAP / 2 }}
        >
          {tileKeys.map((key) => (
            <View
              key={key}
              style={{
                paddingHorizontal: RELATED_TILE_GAP / 2,
                width: `${100 / RELATED_COLUMNS}%`,
              }}
            >
              <SkeletonBlock className="aspect-video rounded" />
              <SkeletonBlock className="mt-2 h-[14px] w-3/4 rounded" />
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
