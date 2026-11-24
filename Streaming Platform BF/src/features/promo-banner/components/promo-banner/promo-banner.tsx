import type { ContentItem, ContentRail } from "@bfbs/common-sdk";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  getPromoBannerWidth,
  pickPromoImage,
} from "@/features/promo-banner/utils/promo-banner";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { openExternalUrl } from "@/utils/external-url";

const LINK_TAGS = { area: "promo_banner", operation: "open_link" };

/** Renders a single promo banner from the provided content rail. */
export function PromoBanner({
  className = "",
  onContentPress,
  rail,
}: {
  className?: string;
  onContentPress?: ((rail: ContentRail, item: ContentItem) => void) | undefined;
  rail: ContentRail;
}) {
  const { isTablet, width: screenWidth } = useDeviceLayout();
  const [failedUrl, setFailedUrl] = useState<string>();
  const image = pickPromoImage(rail.category.media, screenWidth, isTablet);
  const { destination } = rail.category;
  const isPressable =
    destination?.type === "external" ||
    (destination?.type === "asset" && onContentPress !== undefined);
  let accessibilityHint: string | undefined;
  if (destination?.type === "external") {
    accessibilityHint = "Opens the link in your browser";
  } else if (destination?.type === "asset") {
    accessibilityHint = "Opens watch details";
  }

  if (!(image?.width && image.height) || image.url === failedUrl) {
    return null;
  }

  return (
    <View className={`items-center ${className}`} testID="promo-banner">
      <Pressable
        aria-label={rail.category.name}
        accessibilityHint={accessibilityHint}
        role={isPressable ? "link" : "img"}
        disabled={!isPressable}
        onPress={() => {
          if (destination?.type === "asset") {
            // The SDK gives only the id; watch details loads the rest, or shows CNT_002 if it's gone.
            onContentPress?.(rail, {
              contentType: "vod",
              id: destination.assetId,
              title: rail.category.name,
            });
          } else if (destination?.type === "external") {
            void openExternalUrl({ tags: LINK_TAGS, url: destination.url });
          }
        }}
      >
        <Image
          accessibilityIgnoresInvertColors
          cachePolicy="memory-disk"
          contentFit="contain"
          onError={() => setFailedUrl(image.url)}
          // GO file names have spaces and brackets, e.g. "Platform=Tablet [Portrait]".
          source={image.url.replace(/[ [\]]/g, encodeURIComponent)}
          style={{
            aspectRatio: image.width / image.height,
            width: getPromoBannerWidth(screenWidth, isTablet),
          }}
          testID="promo-banner-image"
        />
      </Pressable>
    </View>
  );
}
