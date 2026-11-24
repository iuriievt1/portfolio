import type { DeviceType } from "expo-device";
import { getExpoDeviceModule } from "@/utils/expo-native-modules";

interface LayoutDimensions {
  width: number;
  height: number;
}

interface TabletDeviceParams extends LayoutDimensions {
  deviceType?: DeviceType | null | undefined;
}

const TABLET_MIN_SHORT_SIDE = 600;
const TABLET_MIN_LONG_SIDE = 900;

export function isTabletLayout({ width, height }: LayoutDimensions) {
  return (
    Math.min(width, height) >= TABLET_MIN_SHORT_SIDE &&
    Math.max(width, height) >= TABLET_MIN_LONG_SIDE
  );
}

/** Landscape when the window is wider than it is tall. */
export function isLandscapeLayout({ width, height }: LayoutDimensions) {
  return width > height;
}

/** Tablet by type or size. */
export function isTabletDevice({
  deviceType,
  height,
  width,
}: TabletDeviceParams) {
  const Device = getExpoDeviceModule();
  const resolvedDeviceType =
    deviceType === undefined ? Device.deviceType : deviceType;

  return (
    resolvedDeviceType === Device.DeviceType.TABLET ||
    (resolvedDeviceType !== Device.DeviceType.PHONE &&
      isTabletLayout({ width, height }))
  );
}
