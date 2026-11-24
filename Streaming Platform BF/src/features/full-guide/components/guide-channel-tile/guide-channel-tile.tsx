import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components";
import type { GuideChannel } from "@/features/full-guide/types";
import {
  CARD_RADIUS,
  type GuideMetrics,
} from "@/features/full-guide/utils/guide-metrics";

const NAME_LINE_LIMIT = 2;

type GuideChannelTileProps = {
  channel: GuideChannel;
  metrics: GuideMetrics;
};

/** The channel's square tile, holding its logo or, failing that, its name. */
export function GuideChannelTile({ channel, metrics }: GuideChannelTileProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const logoUrl = channel.logoUrl;
  const showLogo = logoUrl !== undefined && failedLogoUrl !== logoUrl;

  return (
    <View
      className="items-center justify-center bg-medium-slate-blue"
      style={{
        borderRadius: CARD_RADIUS,
        height: metrics.cellHeight,
        width: metrics.tileWidth,
      }}
      testID={`guide-channel-tile-${channel.id}`}
    >
      {showLogo && logoUrl ? (
        <Image
          accessibilityLabel={channel.name}
          contentFit="contain"
          onError={() => setFailedLogoUrl(logoUrl)}
          source={logoUrl}
          style={{ height: metrics.logoHeight, width: metrics.logoWidth }}
          testID={`guide-channel-logo-${channel.id}`}
        />
      ) : (
        <Text
          className="px-1 text-center text-white"
          numberOfLines={NAME_LINE_LIMIT}
          style={{ fontSize: metrics.daySize }}
          weight="bold"
        >
          {channel.name}
        </Text>
      )}
    </View>
  );
}
