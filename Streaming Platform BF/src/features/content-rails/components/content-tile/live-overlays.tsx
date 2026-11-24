import { View } from "react-native";
import { Text } from "@/components";
import { ChannelLogo } from "@/features/content-rails/components/content-tile/channel-logo";
import { TileProgressBar } from "@/features/content-rails/components/content-tile/tile-progress-bar";
import {
  TileScrim,
  TOP_SCRIM_COLOURS,
} from "@/features/content-rails/components/content-tile/tile-scrim";
import { useProgrammeProgress } from "@/features/content-rails/components/content-tile/use-programme-progress";
import type { LiveRailTile, TileSize } from "@/features/content-rails/types";

const CHANNEL_LOGO_SIZE: Record<TileSize, number> = {
  large: 48,
  standard: 32,
};

const LIVE_BADGE_METRICS: Record<
  TileSize,
  {
    borderRadius: number;
    dotBorderWidth: number;
    dotInnerSize: number;
    dotOuterSize: number;
    fontSize: number;
    gap: number;
    height: number;
    lineHeight: number;
    paddingHorizontal: number;
    position: number;
  }
> = {
  large: {
    borderRadius: 2,
    dotBorderWidth: 1,
    dotInnerSize: 4,
    dotOuterSize: 8,
    fontSize: 12,
    gap: 4,
    height: 20,
    lineHeight: 14,
    paddingHorizontal: 6,
    position: 8,
  },
  standard: {
    borderRadius: 2,
    dotBorderWidth: 1,
    dotInnerSize: 3,
    dotOuterSize: 6,
    fontSize: 10,
    gap: 3,
    height: 16,
    lineHeight: 12,
    paddingHorizontal: 4,
    position: 6,
  },
};

/** Live tiles always carry the channel, the LIVE badge and their progress. */
export function LiveOverlays({
  size,
  tile,
}: {
  size: TileSize;
  tile: LiveRailTile;
}) {
  const logoSize = CHANNEL_LOGO_SIZE[size];
  const liveBadgeMetrics = LIVE_BADGE_METRICS[size];
  const progress = useProgrammeProgress({
    endMs: tile.progressEndMs,
    startMs: tile.progressStartMs,
  });

  return (
    <>
      <TileScrim colours={TOP_SCRIM_COLOURS} edge="top" />
      <View
        className="absolute left-2 top-2"
        pointerEvents="none"
        style={{ height: logoSize, width: logoSize }}
      >
        <ChannelLogo
          fallback={
            <Text
              className="text-[12px] leading-[14px] text-white"
              numberOfLines={2}
              testID="content-tile-channel-fallback"
              textBreakStrategy="simple"
              weight="bold"
            >
              {tile.channelName}
            </Text>
          }
          media={tile.channelMedia}
          name={tile.channelName}
        />
      </View>
      {/* Fixed height, not padding: Figma's 6px is measured from cap height. */}
      <View
        className="absolute flex-row items-center bg-transparent-black-80"
        pointerEvents="none"
        style={{
          borderRadius: liveBadgeMetrics.borderRadius,
          gap: liveBadgeMetrics.gap,
          height: liveBadgeMetrics.height,
          paddingHorizontal: liveBadgeMetrics.paddingHorizontal,
          right: liveBadgeMetrics.position,
          top: liveBadgeMetrics.position,
        }}
        testID="content-tile-live-badge"
      >
        <View
          className="items-center justify-center rounded-full border-red"
          style={{
            borderWidth: liveBadgeMetrics.dotBorderWidth,
            height: liveBadgeMetrics.dotOuterSize,
            width: liveBadgeMetrics.dotOuterSize,
          }}
          testID="content-tile-live-badge-dot"
        >
          <View
            className="rounded-full bg-red"
            style={{
              height: liveBadgeMetrics.dotInnerSize,
              width: liveBadgeMetrics.dotInnerSize,
            }}
          />
        </View>
        <Text
          className="text-red"
          style={{
            fontSize: liveBadgeMetrics.fontSize,
            includeFontPadding: false,
            lineHeight: liveBadgeMetrics.lineHeight,
          }}
        >
          LIVE
        </Text>
      </View>
      {progress === undefined ? null : <TileProgressBar progress={progress} />}
    </>
  );
}
