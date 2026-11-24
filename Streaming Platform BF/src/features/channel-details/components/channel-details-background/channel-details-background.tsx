import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import {
  getChannelDetailsGlowColours,
  PHONE_FADE_COLOURS,
  PHONE_FADE_LOCATIONS,
  TABLET_FADE_COLOURS,
} from "@/features/channel-details/utils/gradients";
import { getChannelDetailsTabletMetrics } from "@/features/channel-details/utils/tablet-metrics";
import { useDeviceLayout } from "@/hooks/use-device-layout";

/** Page backdrop: a glow in the top-right corner fading into the base colour. */
export function ChannelDetailsBackground() {
  const { height, isLandscape, isTablet, width } = useDeviceLayout();
  const { bandHeight } = getChannelDetailsTabletMetrics({ isLandscape, width });

  return (
    <View
      className="absolute inset-x-0 top-0"
      pointerEvents="none"
      style={{ height: isTablet ? bandHeight : height }}
      testID="channel-details-background"
    >
      <LinearGradient
        colors={getChannelDetailsGlowColours({ isLandscape, isTablet })}
        end={{ x: 1, y: 0 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={isTablet ? TABLET_FADE_COLOURS : PHONE_FADE_COLOURS}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
        {...(isTablet ? {} : { locations: PHONE_FADE_LOCATIONS })}
      />
    </View>
  );
}
