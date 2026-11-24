import { View } from "react-native";
import { GuideCard } from "@/features/full-guide/components/guide-card/guide-card";
import { GuideCardSkeleton } from "@/features/full-guide/components/guide-card/guide-card-skeleton";
import { useLaidOutCells } from "@/features/full-guide/components/guide-channel-row/use-laid-out-cells";
import type { GuideScroll } from "@/features/full-guide/hooks/use-guide-scroll";
import type { GuideChannel } from "@/features/full-guide/types";
import { isCellLive } from "@/features/full-guide/utils/guide-cells";
import {
  type GuideHeading,
  type GuideTimeline,
  getHiddenWidth,
  getSkeletonCellLayouts,
  getVisibleCellLayouts,
  isNearColumn,
} from "@/features/full-guide/utils/guide-layout";
import {
  type GuideMetrics,
  getRowHeight,
} from "@/features/full-guide/utils/guide-metrics";
import { getDeviceTimeZone } from "@/utils/date-time";

type GuideChannelRowProps = {
  channel: GuideChannel;
  /** Which way the timeline is moving, so the cards drawn run ahead of it. */
  heading: GuideHeading;
  /** Whether the row is on screen, so the text of cards nearing the column follows the native scroll. */
  isTracking: boolean;
  metrics: GuideMetrics;
  nowMs: number;
  onSelectCell: (cellId: string) => void;
  pixelsPerMinute: number;
  scroll: GuideScroll;
  scrollX: number;
  selectedCellId: string | undefined;
  timeline: GuideTimeline;
  timeZone?: string;
  viewportWidth: number;
  width: number;
};

/** One channel's programme cells on the shared timeline canvas. */
export function GuideChannelRow({
  channel,
  heading,
  isTracking,
  metrics,
  nowMs,
  onSelectCell,
  pixelsPerMinute,
  scroll,
  scrollX,
  selectedCellId,
  timeline,
  timeZone = getDeviceTimeZone(),
  viewportWidth,
  width,
}: GuideChannelRowProps) {
  const laidOutCells = useLaidOutCells({
    channel,
    metrics,
    pixelsPerMinute,
    timeline,
  });
  const cards = getVisibleCellLayouts({
    cells: laidOutCells,
    heading,
    scrollX,
    viewportWidth,
  });
  // Rows off screen are only ever seen at rest, where their cards already cover the viewport.
  const skeletons = isTracking
    ? getSkeletonCellLayouts({
        cells: laidOutCells,
        heading,
        scrollX,
        viewportWidth,
      })
    : [];

  return (
    <View
      className="overflow-hidden"
      style={{ height: getRowHeight(metrics), width }}
      testID={`guide-row-${channel.id}`}
    >
      {cards.map(({ cell, layout }) => (
        <GuideCard
          cell={cell}
          hiddenWidth={getHiddenWidth({ layout, metrics, scrollX })}
          isOnAir={isCellLive(cell, nowMs)}
          isSelected={cell.id === selectedCellId}
          key={cell.id}
          left={layout.left}
          metrics={metrics}
          onSelectCell={onSelectCell}
          scrollOffset={
            isTracking &&
            isNearColumn({ layout, metrics, scrollX, viewportWidth })
              ? scroll.scrollOffset
              : null
          }
          timeZone={timeZone}
          width={layout.width}
        />
      ))}

      {skeletons.map(({ cell, layout }) => (
        <GuideCardSkeleton
          key={`skeleton-${cell.id}`}
          left={layout.left}
          metrics={metrics}
          testID={`guide-cell-skeleton-${cell.id}`}
          width={layout.width}
        />
      ))}
    </View>
  );
}
