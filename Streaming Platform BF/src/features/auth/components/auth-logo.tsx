import { View } from "react-native";

import BfbsLogoMobile from "@/assets/images/bfbs-logo-mobile.svg";
import BfbsLogoTabletLandscape from "@/assets/images/bfbs-logo-tablet-landscape.svg";
import BfbsLogoTabletPortrait from "@/assets/images/bfbs-logo-tablet-portrait.svg";
import type { ScreenVariant } from "../screen-variant";

const logos = {
  mobile: { Logo: BfbsLogoMobile, height: 47, width: 139 },
  "tablet-landscape": { Logo: BfbsLogoTabletLandscape, height: 95, width: 283 },
  "tablet-portrait": { Logo: BfbsLogoTabletPortrait, height: 95, width: 283 },
} as const;

/** Centred auth logo. */
export function AuthLogo({ variant }: { variant: ScreenVariant }) {
  const { Logo, height, width } = logos[variant];

  return (
    <View className="items-center">
      <Logo height={height} width={width} />
    </View>
  );
}
