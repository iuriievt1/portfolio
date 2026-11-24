import { useWindowDimensions } from "react-native";
import { isLandscapeLayout, isTabletLayout } from "@/utils/device-layout";

/** Window size with the tablet and landscape flags every adaptive screen reads. */
export function useDeviceLayout() {
  const { height, width } = useWindowDimensions();

  return {
    height,
    isLandscape: isLandscapeLayout({ height, width }),
    isTablet: isTabletLayout({ height, width }),
    width,
  };
}
