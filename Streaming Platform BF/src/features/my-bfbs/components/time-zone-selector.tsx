import { useState } from "react";
import { Pressable, View } from "react-native";
import CheckIcon from "@/assets/icons/check-icon.svg";
import ChevronUpIcon from "@/assets/icons/chevron-up-icon.svg";
import { Text } from "@/components";
import { theme } from "@/theme/theme";
import { formatClockTime } from "@/utils/date-time";
import {
  getListingTimeZone,
  TIME_ZONE_PREFERENCE,
  type TimeZonePreference,
} from "../time-zone-preference";
import {
  setTimeZonePreference,
  useTimeZonePreference,
} from "../time-zone-preference-store";

const OPTIONS = [
  { label: "Device Time", preference: TIME_ZONE_PREFERENCE.DEVICE },
  { label: "UK Time", preference: TIME_ZONE_PREFERENCE.UK },
] as const;

type TimeZoneSelectorProps = {
  isTablet: boolean;
  nowMs: number;
};

/** Figma-matched selector for the two supported listing time zones. */
export function TimeZoneSelector({ isTablet, nowMs }: TimeZoneSelectorProps) {
  const preference = useTimeZonePreference();
  const [isExpanded, setIsExpanded] = useState(true);
  const selectedLabel =
    preference === TIME_ZONE_PREFERENCE.DEVICE ? "Device" : "UK";
  const selectedTime = formatClockTime({
    timeMs: nowMs,
    timeZone: getListingTimeZone(preference),
  });

  const selectPreference = (nextPreference: TimeZonePreference) => {
    setTimeZonePreference(nextPreference);
  };

  return (
    <View className="w-full gap-5">
      <Pressable
        accessibilityLabel={`${selectedLabel} time, ${selectedTime}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        className={`min-h-[50px] flex-row items-center rounded-full bg-transparent-white-10 py-2 ${isTablet ? "px-6" : "px-4"}`}
        onPress={() => setIsExpanded((expanded) => !expanded)}
        testID="time-zone-selector-toggle"
      >
        <Text
          className="flex-1 text-center text-[16px] text-white"
          weight="semibold"
        >
          {selectedLabel} - {selectedTime}
        </Text>
        <ChevronUpIcon
          color={theme.colors.white}
          height={16}
          style={{ transform: [{ rotate: isExpanded ? "0deg" : "180deg" }] }}
          width={16}
        />
      </Pressable>

      {isExpanded ? (
        <View
          className={`rounded-[20px] bg-transparent-white-10 ${isTablet ? "gap-8 p-6" : "gap-4 p-4"}`}
          testID="time-zone-selector-options"
        >
          {OPTIONS.map((option) => {
            const isSelected = option.preference === preference;
            const optionTime = formatClockTime({
              timeMs: nowMs,
              timeZone: getListingTimeZone(option.preference),
            });

            return (
              <Pressable
                accessibilityLabel={`${option.label}, ${optionTime}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                className="min-h-8 flex-row items-center"
                hitSlop={8}
                key={option.preference}
                onPress={() => selectPreference(option.preference)}
                testID={`time-zone-option-${option.preference}`}
              >
                <Text
                  className="flex-1 text-center text-[16px] text-white"
                  weight="semibold"
                >
                  {option.label} - {optionTime}
                </Text>
                <View className="h-4 w-4 items-center justify-center">
                  {isSelected ? (
                    <CheckIcon
                      color={theme.colors.white}
                      height={12}
                      width={16}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
