import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import { BackButton, ProgrammeArtwork } from "@/components";
import {
  DARK_SLATE_BLUE,
  TRANSPARENT_TO_DARK_GRADIENT,
} from "@/features/watch-details/utils/gradients";
import { withAlpha } from "@/utils/colour";

export const HERO_ASPECT_RATIO = 16 / 9;
const GRADIENT_HEIGHT = 70;
const CHANNEL_LOGO_SIZE = 45;
export const BACK_ICON_WIDTH = 12;
export const BACK_ICON_HEIGHT = 20;
const EDGE_INSET = 16;
const TOP_GRADIENT_COLORS = [
  withAlpha(DARK_SLATE_BLUE, 0.6),
  withAlpha(DARK_SLATE_BLUE, 0),
] as const;

type WatchDetailsHeroProps = {
  backTestID: string;
  channelLogoUrl?: string | undefined;
  imageUrl: string | undefined;
  onBack: () => void;
};

/** Phone hero: full-bleed artwork carrying the Back control and channel logo. */
export function WatchDetailsHero({
  backTestID,
  channelLogoUrl,
  imageUrl,
  onBack,
}: WatchDetailsHeroProps) {
  return (
    <View
      className="w-full bg-medium-slate-blue"
      style={{ aspectRatio: HERO_ASPECT_RATIO }}
    >
      <ProgrammeArtwork imageUrl={imageUrl} />
      <LinearGradient
        colors={TOP_GRADIENT_COLORS}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={{
          height: GRADIENT_HEIGHT,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      />
      <LinearGradient
        colors={TRANSPARENT_TO_DARK_GRADIENT}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={{
          bottom: 0,
          height: GRADIENT_HEIGHT,
          left: 0,
          position: "absolute",
          right: 0,
        }}
      />
      {channelLogoUrl ? (
        <Image
          contentFit="contain"
          source={channelLogoUrl}
          style={{
            bottom: EDGE_INSET,
            height: CHANNEL_LOGO_SIZE,
            position: "absolute",
            right: EDGE_INSET,
            width: CHANNEL_LOGO_SIZE,
          }}
        />
      ) : null}
      <BackButton
        className="absolute"
        iconHeight={BACK_ICON_HEIGHT}
        iconWidth={BACK_ICON_WIDTH}
        onPress={onBack}
        style={{ left: EDGE_INSET, top: EDGE_INSET }}
        testID={backTestID}
        textClassName="text-[14px] leading-[20px] text-white"
      />
    </View>
  );
}
