import { View } from "react-native";
import { Text } from "@/components";
import { ChannelLogo } from "@/features/content-rails/components/content-tile/channel-logo";
import { TileProgressBar } from "@/features/content-rails/components/content-tile/tile-progress-bar";
import { TileRank } from "@/features/content-rails/components/content-tile/tile-rank";
import {
  TileScrim,
  VOD_BOTTOM_SCRIM_COLOURS,
  VOD_TOP_SCRIM_COLOURS,
} from "@/features/content-rails/components/content-tile/tile-scrim";
import type { TileSize, VodRailTile } from "@/features/content-rails/types";
import {
  TILE_CHANNEL_LOGO_HEIGHT,
  TILE_CHANNEL_LOGO_INSET,
  TILE_CHANNEL_LOGO_MAX_WIDTH,
} from "@/features/content-rails/utils/tile-metrics";
import { formatVodTime } from "@/features/video-player/utils/vod-timing";

function DurationBadge({ durationSeconds }: { durationSeconds: number }) {
  return (
    <View
      className="absolute right-2 top-3 rounded-[2px] border border-slate-blue bg-transparent-black-80 px-[6px] py-2"
      pointerEvents="none"
      testID="content-tile-duration"
    >
      <Text className="text-[14px] leading-[14px] text-white" weight="normal">
        {formatVodTime(durationSeconds)}
      </Text>
    </View>
  );
}

/** A VOD tile carries a scrim only where it has something to show over it. */
export function VodOverlays({
  progress,
  rank,
  size = "standard",
  tile,
  showsDuration = false,
}: {
  progress?: number | undefined;
  rank?: number | undefined;
  size?: TileSize;
  tile: VodRailTile;
  showsDuration?: boolean;
}) {
  const hasProgress = progress !== undefined;
  const hasRank = rank !== undefined;
  const hasDuration = showsDuration && tile.durationSeconds !== undefined;

  if (!(tile.channelMedia || hasProgress || hasRank || hasDuration)) {
    return null;
  }

  return (
    <>
      {tile.channelMedia ? (
        <>
          <TileScrim colours={VOD_TOP_SCRIM_COLOURS} edge="top" />
          <View
            className="absolute"
            pointerEvents="none"
            style={{
              height: TILE_CHANNEL_LOGO_HEIGHT,
              left: TILE_CHANNEL_LOGO_INSET,
              top: TILE_CHANNEL_LOGO_INSET,
              width: TILE_CHANNEL_LOGO_MAX_WIDTH,
            }}
          >
            <ChannelLogo media={tile.channelMedia} name={tile.channelName} />
          </View>
        </>
      ) : null}
      {hasProgress ? <TileProgressBar progress={progress} /> : null}
      {hasRank ? (
        <>
          <TileScrim colours={VOD_BOTTOM_SCRIM_COLOURS} edge="bottom" />
          <TileRank rank={rank} size={size} />
        </>
      ) : null}
      {showsDuration && tile.durationSeconds !== undefined ? (
        <DurationBadge durationSeconds={tile.durationSeconds} />
      ) : null}
    </>
  );
}
