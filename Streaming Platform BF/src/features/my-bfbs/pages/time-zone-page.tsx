import { View } from "react-native";
import { Text } from "@/components";
import { useCurrentTime } from "@/hooks/use-current-time";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { MINUTE_MS } from "@/utils/date-time";
import { TimeZoneSelector } from "../components/time-zone-selector";

/** Lets the user choose how listing times are presented throughout the app. */
export function TimeZonePage() {
  const { isLandscape, isTablet } = useDeviceLayout();
  const nowMs = useCurrentTime(true, MINUTE_MS);

  return (
    <View
      className="w-full gap-5"
      style={isTablet ? { maxWidth: isLandscape ? 592 : 396 } : undefined}
      testID="time-zone-page"
    >
      <Text
        className={`${isTablet ? "text-[18px]" : "text-[14px]"} text-oatmeal`}
      >
        Set your time zone so Live events and schedules show your preferred
        time.
      </Text>
      <TimeZoneSelector isTablet={isTablet} nowMs={nowMs} />
    </View>
  );
}
