import { Animated, View } from "react-native";
import {
  CARD_RADIUS,
  type GuideMetrics,
  getRowHeight,
} from "@/features/full-guide/utils/guide-metrics";
import { HERO_ASPECT_RATIO } from "@/features/watch-details/components/watch-details-hero/watch-details-hero";
import { SkeletonBlock } from "@/features/watch-details/components/watch-details-skeleton/skeleton-block";
import { usePulseOpacity } from "@/hooks/use-pulse-opacity";

const SKELETON_ROW_COUNT = 8;
const SKELETON_ROW_KEYS = Array.from(
  { length: SKELETON_ROW_COUNT },
  (_, index) => `guide-skeleton-row-${index}`,
);

type FullGuideSkeletonProps = {
  isTablet: boolean;
  metrics: GuideMetrics;
};

/** Holds the guide's shape while it loads, so the grid never jumps into place. */
export function FullGuideSkeleton({
  isTablet,
  metrics,
}: FullGuideSkeletonProps) {
  const opacity = usePulseOpacity();

  return (
    <Animated.View
      accessibilityLabel="Loading guide"
      accessibilityRole="progressbar"
      className="flex-1"
      style={{ opacity }}
      testID="full-guide-skeleton"
    >
      {isTablet ? null : (
        <View
          className="w-full bg-medium-slate-blue"
          style={{ aspectRatio: HERO_ASPECT_RATIO }}
        />
      )}

      <View style={{ gap: metrics.heroTitleGap, padding: metrics.edgeInset }}>
        <SkeletonBlock className="h-[35px] w-3/4 rounded" />
        <SkeletonBlock className="h-[20px] w-2/5 rounded" />
      </View>

      <View style={{ paddingHorizontal: metrics.edgeInset }}>
        <SkeletonBlock
          className="w-1/4 rounded"
          style={{ height: metrics.headerHeight }}
        />
      </View>

      {SKELETON_ROW_KEYS.map((key) => (
        <View
          className="flex-row"
          key={key}
          style={{
            gap: metrics.cellGap,
            height: getRowHeight(metrics),
            paddingLeft: metrics.edgeInset,
          }}
        >
          <SkeletonBlock
            style={{
              borderRadius: CARD_RADIUS,
              height: metrics.cellHeight,
              width: metrics.tileWidth,
            }}
          />
          <SkeletonBlock
            className="flex-1"
            style={{ borderRadius: CARD_RADIUS, height: metrics.cellHeight }}
          />
          <SkeletonBlock
            className="flex-[2]"
            style={{ borderRadius: CARD_RADIUS, height: metrics.cellHeight }}
          />
        </View>
      ))}
    </Animated.View>
  );
}
