import { View } from "react-native";
import { GuideCardSkeleton } from "@/features/full-guide/components/guide-card/guide-card-skeleton";
import { useLaidOutCells } from "@/features/full-guide/components/guide-channel-row/use-laid-out-cells";
import type { GuideChannel } from "@/features/full-guide/types";
import {
  type GuideTimeline,
  getOnScreenCellLayouts,
} from "@/features/full-guide/utils/guide-layout";
import {
  type GuideMetrics,
  getRowHeight,
} from "@/features/full-guide/utils/guide-metrics";

type GuideRowSkeletonProps = {
  channel: GuideChannel;
  metrics: GuideMetrics;
  pixelsPerMinute: number;
  scrollX: number;
  timeline: GuideTimeline;
  viewportWidth: number;
  width: number;
};

/**
 * A row's place while its cards are still to be drawn: skeletons in its programmes' real shapes across the
 * viewport, so a fast vertical fling meets placeholders that the cards then replace in place.
 */
export function GuideRowSkeleton({
  channel,
  metrics,
  pixelsPerMinute,
  scrollX,
  timeline,
  viewportWidth,
  width,
}: GuideRowSkeletonProps) {
  const laidOutCells = useLaidOutCells({
    channel,
    metrics,
    pixelsPerMinute,
    timeline,
  });

  return (
    <View
      className="overflow-hidden"
      style={{ height: getRowHeight(metrics), width }}
      testID={`guide-row-skeleton-${channel.id}`}
    >
      {getOnScreenCellLayouts({
        cells: laidOutCells,
        scrollX,
        viewportWidth,
      }).map(({ cell, layout }) => (
        <GuideCardSkeleton
          key={cell.id}
          left={layout.left}
          metrics={metrics}
          testID={`guide-row-skeleton-cell-${cell.id}`}
          width={layout.width}
        />
      ))}
    </View>
  );
}
