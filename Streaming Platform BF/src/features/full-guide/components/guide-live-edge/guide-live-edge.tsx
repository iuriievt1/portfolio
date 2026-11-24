import { Animated, View } from "react-native";
import { Text } from "@/components";
import { getPinnedFadeRange } from "@/features/full-guide/utils/guide-layout";
import type { GuideMetrics } from "@/features/full-guide/utils/guide-metrics";
import { formatClockTime, getDeviceTimeZone } from "@/utils/date-time";

const CLOCK_BOX_SCALE = 2;
const POINTER_WIDTH = 14;
const DASH_GAP = 8;
const DASH_HEIGHT = 6;
const LINE_WIDTH = 2;

type GuideLiveEdgeProps = {
  height: number;
  left: number;
  metrics: GuideMetrics;
  nowMs: number;
  scrollOffset: Animated.Value;
  timeZone?: string;
};

/** The live edge: the clock and its pointer over a dashed line down the grid. */
export function GuideLiveEdge({
  height,
  left,
  metrics,
  nowMs,
  scrollOffset,
  timeZone = getDeviceTimeZone(),
}: GuideLiveEdgeProps) {
  const dashOffsets = Array.from(
    { length: Math.max(Math.ceil(height / (DASH_HEIGHT + DASH_GAP)), 0) },
    (_dash, index) => index * (DASH_HEIGHT + DASH_GAP),
  );
  const boxWidth = metrics.clockWidth * CLOCK_BOX_SCALE;
  const markerOpacity = scrollOffset.interpolate(
    getPinnedFadeRange(left - metrics.clockWidth / 2, metrics),
  );

  return (
    <Animated.View
      className="absolute top-0 items-center"
      pointerEvents="none"
      style={{
        left: left - boxWidth / 2,
        opacity: markerOpacity,
        width: boxWidth,
      }}
      testID="guide-live-edge"
    >
      <View
        className="items-center justify-end"
        style={{ height: metrics.headerHeight }}
      >
        <Text
          className="text-red"
          style={{
            fontSize: metrics.rulerSize,
            marginBottom: metrics.clockGap,
          }}
          testID="guide-live-clock"
          weight="semibold"
        >
          {formatClockTime({ timeMs: nowMs, timeZone })}
        </Text>
        <View
          className="border-l-transparent border-r-transparent border-t-red"
          style={{
            borderLeftWidth: POINTER_WIDTH / 2,
            borderRightWidth: POINTER_WIDTH / 2,
            borderTopWidth: metrics.pointerHeight,
          }}
        />
      </View>

      {dashOffsets.map((offset) => (
        <View
          className="bg-red"
          key={offset}
          style={{
            height: DASH_HEIGHT,
            marginBottom: DASH_GAP,
            width: LINE_WIDTH,
          }}
        />
      ))}
    </Animated.View>
  );
}
