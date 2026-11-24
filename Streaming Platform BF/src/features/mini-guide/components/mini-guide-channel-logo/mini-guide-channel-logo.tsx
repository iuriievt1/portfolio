import { Image } from "expo-image";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Text } from "@/components";
import { MINI_GUIDE_TILE } from "../../constants";
import type { MiniGuideVariant } from "../../types";

type MiniGuideChannelLogoProps = {
  logoUrl: string | undefined;
  name: string;
  variant: MiniGuideVariant;
};

/** Renders a Mini Guide channel logo, with a text fallback for missing images. */
export function MiniGuideChannelLogo({
  logoUrl,
  name,
  variant,
}: MiniGuideChannelLogoProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const shouldShowLogo = Boolean(logoUrl) && failedLogoUrl !== logoUrl;
  const resolvedLogoUrl = shouldShowLogo ? logoUrl : null;

  const handleImageError = useCallback(() => {
    setFailedLogoUrl(logoUrl ?? null);
  }, [logoUrl]);

  if (!resolvedLogoUrl) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text
          className="text-center text-white"
          numberOfLines={2}
          textBreakStrategy="simple"
          style={{
            fontSize: MINI_GUIDE_TILE.logoFallbackFontSize,
            lineHeight: MINI_GUIDE_TILE.logoFallbackLineHeight,
          }}
          weight="semibold"
        >
          {name}
        </Text>
      </View>
    );
  }

  if (variant !== "tablet-landscape") {
    return (
      <View className="flex-1 items-center justify-center">
        <Image
          accessibilityLabel={name}
          cachePolicy="memory-disk"
          contentFit="contain"
          onError={handleImageError}
          recyclingKey={resolvedLogoUrl}
          source={{ uri: resolvedLogoUrl }}
          style={{
            height: MINI_GUIDE_TILE.logoImageHeight,
            width: MINI_GUIDE_TILE.logoImageWidth,
          }}
        />
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={name}
      cachePolicy="memory-disk"
      contentFit="contain"
      onError={handleImageError}
      recyclingKey={resolvedLogoUrl}
      source={{ uri: resolvedLogoUrl }}
      style={{ flex: 1 }}
    />
  );
}
