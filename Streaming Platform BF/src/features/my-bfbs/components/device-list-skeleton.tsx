import { View } from "react-native";
import { useDeviceLayout } from "@/hooks/use-device-layout";

const ROW_COUNT = 6;
const ROW_KEYS = Array.from(
  { length: ROW_COUNT },
  (_, index) => `device-skeleton-row-${index}`,
);

// Grey placeholder rows in the shape of the device rows, shown while they load.
export function DeviceListSkeleton() {
  const { isTablet } = useDeviceLayout();
  // Bar heights match the name and date text sizes.
  const nameHeight = isTablet ? "h-4" : "h-[14px]";
  const dateHeight = isTablet ? "h-[14px]" : "h-3";
  // Matches the device icon: 30 on tablet, 20 on phone.
  const iconSize = isTablet ? "h-[30px] w-[30px]" : "h-5 w-5";

  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      className="gap-2"
      testID="device-list-skeleton"
    >
      {ROW_KEYS.map((key) => (
        <View className="flex-row items-center gap-5 py-3" key={key}>
          <View className={`${iconSize} rounded bg-transparent-white-10`} />
          <View className="flex-1 gap-2">
            <View
              className={`${nameHeight} w-1/2 rounded bg-transparent-white-10`}
            />
            <View
              className={`${dateHeight} w-3/4 rounded bg-transparent-white-10`}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
