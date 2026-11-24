import type { MediaImage } from "@bfbs/common-sdk";
import { Image, type ImageContentPosition } from "expo-image";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import { pickChannelLogoUrl } from "@/utils/media";

/** The channel's logo, falling back when it is missing or fails to load. */
export function ChannelLogo({
  contentPosition = "top left",
  fallback,
  media,
  name,
}: {
  contentPosition?: ImageContentPosition;
  fallback?: ReactNode;
  media: MediaImage[] | undefined;
  name: string | undefined;
}) {
  const logoUrl = pickChannelLogoUrl(media);
  // Tracks the URL, not a flag: FlatList recycles tiles.
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const channelLogoUrl = logoUrl === failedLogoUrl ? undefined : logoUrl;

  const handleLogoError = useCallback(() => {
    setFailedLogoUrl(logoUrl ?? null);
  }, [logoUrl]);

  if (!channelLogoUrl) {
    return fallback ?? null;
  }

  return (
    <Image
      cachePolicy="memory-disk"
      contentFit="contain"
      contentPosition={contentPosition}
      onError={handleLogoError}
      recyclingKey={channelLogoUrl}
      source={channelLogoUrl}
      style={StyleSheet.absoluteFill}
      {...(name ? { accessibilityLabel: name } : {})}
    />
  );
}
