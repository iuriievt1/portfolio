import { Modal, Pressable, View } from "react-native";
import { Text } from "@/components";
import type { GuideDay } from "@/features/full-guide/types";
import { formatDayLabel } from "@/features/full-guide/utils/format-day-label";
import {
  CARD_RADIUS,
  type GuideMetrics,
} from "@/features/full-guide/utils/guide-metrics";
import { getDeviceTimeZone } from "@/utils/date-time";

type GuideDaySelectorProps = {
  days: GuideDay[];
  isVisible: boolean;
  metrics: GuideMetrics;
  nowMs: number;
  onDismiss: () => void;
  onSelectDay: (dayIndex: number) => void;
  timeZone?: string;
  visibleDayIndex: number;
};

/** The week, offered as a list under the day label. */
export function GuideDaySelector({
  days,
  isVisible,
  metrics,
  nowMs,
  onDismiss,
  onSelectDay,
  timeZone = getDeviceTimeZone(),
  visibleDayIndex,
}: GuideDaySelectorProps) {
  return (
    <Modal
      accessibilityViewIsModal
      animationType="fade"
      onRequestClose={onDismiss}
      transparent
      visible={isVisible}
    >
      <Pressable
        accessibilityLabel="Close the day selector"
        accessibilityRole="button"
        className="flex-1 bg-transparent-black-70"
        onPress={onDismiss}
      >
        <View
          className="self-start bg-medium-slate-blue"
          style={{ borderRadius: CARD_RADIUS, margin: metrics.edgeInset }}
          testID="guide-day-selector"
        >
          {days.map((day, index) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: index === visibleDayIndex }}
              className="px-4 py-3"
              key={day.key}
              onPress={() => onSelectDay(index)}
              testID={`guide-day-option-${day.key}`}
            >
              <Text className="text-[16px] text-white">
                {formatDayLabel({
                  dayStartMs: day.startMs,
                  nowMs,
                  timeZone,
                })}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
