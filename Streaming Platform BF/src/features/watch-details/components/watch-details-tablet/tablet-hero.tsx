import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { View, type ViewStyle } from "react-native";
import { ProgrammeArtwork } from "@/components";
import type { TabletMetrics } from "@/features/watch-details/components/watch-details-tablet/tablet-metrics";
import {
  DARK_TO_TRANSPARENT_GRADIENT,
  TRANSPARENT_TO_DARK_GRADIENT,
} from "@/features/watch-details/utils/gradients";

const CHANNEL_LOGO_RIGHT = 40;
const IMAGE_TRANSITION_MS = 200;

/** Tablet watch-details hero: artwork beside the metadata and actions column. */
export function TabletHero({
  channelLogoUrl,
  imageUrl,
  metrics,
  sizeStyle,
  testID,
}: {
  channelLogoUrl?: string | undefined;
  imageUrl: string | undefined;
  metrics: TabletMetrics;
  /** Width and height, as numbers or as layout rules. */
  sizeStyle: ViewStyle;
  testID?: string;
}) {
  return (
    <View
      className="absolute right-0 top-0 overflow-hidden bg-medium-slate-blue"
      style={sizeStyle}
      testID={testID}
    >
      <ProgrammeArtwork
        imageUrl={imageUrl}
        transitionMs={IMAGE_TRANSITION_MS}
      />
      <View className="absolute inset-0 bg-transparent-black-20" />
      <LinearGradient
        colors={DARK_TO_TRANSPARENT_GRADIENT}
        end={{ x: 1, y: 0.5 }}
        start={{ x: 0, y: 0.5 }}
        style={{
          bottom: 0,
          left: 0,
          position: "absolute",
          top: 0,
          width: `${metrics.heroLeftGradientRatio * 100}%`,
        }}
      />
      <LinearGradient
        colors={TRANSPARENT_TO_DARK_GRADIENT}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0 }}
        style={{
          bottom: 0,
          height: `${metrics.heroBottomGradientRatio * 100}%`,
          left: 0,
          position: "absolute",
          right: 0,
        }}
      />
      {channelLogoUrl ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="contain"
          source={channelLogoUrl}
          style={{
            bottom: metrics.channelLogoBottom,
            height: metrics.channelLogoSize,
            position: "absolute",
            right: CHANNEL_LOGO_RIGHT,
            width: metrics.channelLogoSize,
          }}
        />
      ) : null}
    </View>
  );
}
