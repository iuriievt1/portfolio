import { Pressable, View } from "react-native";
import { Text } from "@/components";
import {
  type GuideMetrics,
  getColumnWidth,
} from "@/features/full-guide/utils/guide-metrics";

type GuideDayCornerProps = {
  dayLabel: string;
  metrics: GuideMetrics;
  onPressDay: () => void;
};

/** The table's fixed corner: the day over the channel column, clear of the ruler. */
export function GuideDayCorner({
  dayLabel,
  metrics,
  onPressDay,
}: GuideDayCornerProps) {
  return (
    <View
      className="absolute left-0 top-0 bg-dark-slate-blue"
      style={{ height: metrics.headerHeight, width: getColumnWidth(metrics) }}
      testID="guide-day-corner"
    >
      <Pressable
        accessibilityRole="button"
        className="justify-center"
        onPress={onPressDay}
        style={{
          height: metrics.dayLabelHeight,
          paddingLeft: metrics.edgeInset,
        }}
        testID="guide-day-label"
      >
        <Text
          className="text-white"
          style={{ fontSize: metrics.daySize }}
          weight="bold"
        >
          {dayLabel}
        </Text>
      </Pressable>
    </View>
  );
}
