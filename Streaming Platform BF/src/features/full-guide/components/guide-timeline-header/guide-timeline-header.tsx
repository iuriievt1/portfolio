import { View } from "react-native";
import { Text } from "@/components";
import {
  type GuideTimeline,
  getOffsetForTime,
} from "@/features/full-guide/utils/guide-layout";
import type { GuideMetrics } from "@/features/full-guide/utils/guide-metrics";
import {
  getRulerMarks,
  isUnderLiveClock,
} from "@/features/full-guide/utils/guide-ruler";
import { formatClockTime, getDeviceTimeZone } from "@/utils/date-time";

type GuideTimelineHeaderProps = {
  metrics: GuideMetrics;
  nowMs: number;
  pixelsPerMinute: number;
  scrollX: number;
  timeline: GuideTimeline;
  timeZone?: string;
  viewportWidth: number;
};

/** The windowed half-hour ruler on the shared timeline canvas; marks pass under the day corner. */
export function GuideTimelineHeader({
  metrics,
  nowMs,
  pixelsPerMinute,
  scrollX,
  timeline,
  timeZone = getDeviceTimeZone(),
  viewportWidth,
}: GuideTimelineHeaderProps) {
  const clockLeft = getOffsetForTime({
    pixelsPerMinute,
    timeMs: nowMs,
    timeline,
  });
  const rulerMarks = getRulerMarks({
    pixelsPerMinute,
    scrollX,
    timeline,
    viewportWidth,
  });

  return (
    <View
      style={{ height: metrics.headerHeight }}
      testID="guide-timeline-ruler"
    >
      {rulerMarks.map((markMs) => {
        const markLeft = getOffsetForTime({
          pixelsPerMinute,
          timeMs: markMs,
          timeline,
        });

        if (
          isUnderLiveClock({
            clockLeft,
            clockWidth: metrics.clockWidth,
            markLeft,
          })
        ) {
          return null;
        }

        return (
          <View
            className="absolute top-0"
            key={markMs}
            style={{ left: markLeft }}
          >
            <Text
              className="text-white"
              style={{
                fontSize: metrics.rulerSize,
                height: metrics.dayLabelHeight,
              }}
              weight="bold"
            >
              {formatClockTime({ timeMs: markMs, timeZone })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
