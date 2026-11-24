import type * as Device from "expo-device";

export type SplashScreenProps = {
  onReady?: () => void;
};

export type SplashScreenVariantParams = {
  width: number;
  height: number;
  deviceType?: Device.DeviceType | null;
};

export type SplashScreenVariant =
  | "mobile"
  | "tablet-portrait"
  | "tablet-landscape";
