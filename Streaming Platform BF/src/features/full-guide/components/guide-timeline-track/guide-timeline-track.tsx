import { createContext, use, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { GuideLiveEdge } from "@/features/full-guide/components/guide-live-edge/guide-live-edge";
import { GuideTimelineHeader } from "@/features/full-guide/components/guide-timeline-header/guide-timeline-header";
import {
  type GuideTimeline,
  getOffsetForTime,
} from "@/features/full-guide/utils/guide-layout";
import type { GuideMetrics } from "@/features/full-guide/utils/guide-metrics";

/** Where the drawn stretch of the timeline is anchored, for the ruler to window its marks. */
export const GuideWindowContext = createContext(0);

type GuideTimelineTrackProps = {
  height: number;
  metrics: GuideMetrics;
  nowMs: number;
  pixelsPerMinute: number;
  scrollOffset: Animated.Value;
  timeline: GuideTimeline;
  timeZone: string;
  viewportWidth: number;
  width: number;
};

/**
 * The ruler and live edge over the whole grid, slid by the timeline's native offset. It sits outside the vertical
 * scroll so the ruler stays put, and only re-renders when the clock or the scale changes: a React commit of a
 * natively driven view draws it at the value's stale JS offset, so it must not re-render while the timeline moves.
 */
export function GuideTimelineTrack({
  height,
  metrics,
  nowMs,
  pixelsPerMinute,
  scrollOffset,
  timeline,
  timeZone,
  viewportWidth,
  width,
}: GuideTimelineTrackProps) {
  const [scrollBack] = useState(() => Animated.multiply(scrollOffset, -1));

  return (
    <View
      pointerEvents="none"
      style={styles.frame}
      testID="guide-timeline-track"
    >
      <Animated.View
        style={{ height, transform: [{ translateX: scrollBack }], width }}
      >
        <WindowedRuler
          metrics={metrics}
          nowMs={nowMs}
          pixelsPerMinute={pixelsPerMinute}
          timeline={timeline}
          timeZone={timeZone}
          viewportWidth={viewportWidth}
        />

        <GuideLiveEdge
          height={height}
          left={getOffsetForTime({ pixelsPerMinute, timeMs: nowMs, timeline })}
          metrics={metrics}
          nowMs={nowMs}
          scrollOffset={scrollOffset}
          timeZone={timeZone}
        />
      </Animated.View>
    </View>
  );
}

/** The ruler windowed around the anchor, re-rendering on its own as the anchor moves. */
function WindowedRuler({
  metrics,
  nowMs,
  pixelsPerMinute,
  timeline,
  timeZone,
  viewportWidth,
}: {
  metrics: GuideMetrics;
  nowMs: number;
  pixelsPerMinute: number;
  timeline: GuideTimeline;
  timeZone: string;
  viewportWidth: number;
}) {
  return (
    <GuideTimelineHeader
      metrics={metrics}
      nowMs={nowMs}
      pixelsPerMinute={pixelsPerMinute}
      scrollX={use(GuideWindowContext)}
      timeline={timeline}
      timeZone={timeZone}
      viewportWidth={viewportWidth}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
});
