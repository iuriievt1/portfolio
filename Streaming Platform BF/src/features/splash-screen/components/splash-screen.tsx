import { Image } from "expo-image";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import mobileSplashSource from "@/assets/images/splash-screen-mobile.png";
import tabletLandscapeSplashSource from "@/assets/images/splash-screen-tablet-landscape.png";
import tabletPortraitSplashSource from "@/assets/images/splash-screen-tablet-portrait.png";
import { isLandscapeLayout, isTabletDevice } from "@/utils/device-layout";

import type {
  SplashScreenProps,
  SplashScreenVariant,
  SplashScreenVariantParams,
} from "../types";

export function getSplashScreenVariant({
  deviceType,
  width,
  height,
}: SplashScreenVariantParams): SplashScreenVariant {
  if (!isTabletDevice({ deviceType, height, width })) {
    return "mobile";
  }

  return isLandscapeLayout({ height, width })
    ? "tablet-landscape"
    : "tablet-portrait";
}

function getSplashScreenSource(variant: SplashScreenVariant) {
  if (variant === "tablet-portrait") {
    return tabletPortraitSplashSource;
  }

  if (variant === "tablet-landscape") {
    return tabletLandscapeSplashSource;
  }

  return mobileSplashSource;
}

export function SplashScreen({ onReady }: SplashScreenProps) {
  const { width, height } = useWindowDimensions();
  const variant = getSplashScreenVariant({ width, height });
  const source = getSplashScreenSource(variant);
  const imageReadyHandlers = onReady
    ? {
        onError: onReady,
        onLoad: onReady,
      }
    : {};

  return (
    <View className="flex-1 bg-black" testID="splash-screen">
      <Image
        contentFit="cover"
        source={source}
        style={StyleSheet.absoluteFillObject}
        testID="splash-screen-image"
        {...imageReadyHandlers}
      />
    </View>
  );
}
