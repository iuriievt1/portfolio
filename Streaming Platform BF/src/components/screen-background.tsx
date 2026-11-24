import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import screenBackgroundSource from "@/assets/images/sign-in-background-mobile.png";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { theme } from "@/theme/theme";
import { withAlpha } from "@/utils/colour";

/** "transparent" bands on Android. */
const FADE_OUT = withAlpha(theme.colors["dark-slate-blue"], 0);

const SIDE_FADE_COLOURS = [theme.colors.black, FADE_OUT] as const;
const PORTRAIT_FLOOR_COLOURS = [FADE_OUT, theme.colors.black] as const;
const LANDSCAPE_FLOOR_COLOURS = [
  FADE_OUT,
  theme.colors["dark-slate-blue"],
] as const;

type ScreenBackgroundProps = {
  /** Phone sign-in photo. */
  artwork?: boolean;
};

/** Shared sign-in and error backdrop. */
export function ScreenBackground({ artwork = true }: ScreenBackgroundProps) {
  const { isLandscape, isTablet } = useDeviceLayout();

  if (!isTablet && artwork) {
    return (
      <Image
        contentFit="cover"
        pointerEvents="none"
        source={screenBackgroundSource}
        style={StyleSheet.absoluteFill}
        testID="screen-background-artwork"
      />
    );
  }

  return (
    <View
      className="absolute inset-0 bg-medium-slate-blue"
      pointerEvents="none"
      testID="screen-background-gradient"
    >
      <LinearGradient
        colors={SIDE_FADE_COLOURS}
        end={{ x: 1, y: 0 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={isLandscape ? LANDSCAPE_FLOOR_COLOURS : PORTRAIT_FLOOR_COLOURS}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
