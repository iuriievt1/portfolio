import { type DimensionValue, Pressable, View } from "react-native";
import { ProgrammeArtwork, Text } from "@/components";
import { GenreOverlay } from "@/features/content-rails/components/content-tile/genre-overlay";
import { LiveOverlays } from "@/features/content-rails/components/content-tile/live-overlays";
import { VodOverlays } from "@/features/content-rails/components/content-tile/vod-overlays";
import type { RailTile, TileSize } from "@/features/content-rails/types";
import type { TileVariant } from "@/features/content-rails/utils/tile-metrics";
import {
  getTileAspectRatio,
  TILE_CORNER_RADIUS,
  TILE_LABEL_LETTER_SPACING,
  TILE_LABEL_LINE_HEIGHT,
  TILE_LABEL_LINES,
  TILE_LABEL_MARGIN_TOP,
  TILE_LABEL_SIZE,
  TILE_VARIANT,
} from "@/features/content-rails/utils/tile-metrics";
import { formatVodTime } from "@/features/video-player/utils/vod-timing";
import { pickImageUrlForAspectRatio } from "@/utils/media";

const TILE_TRANSITION_MS = 200;

interface ContentTileProps {
  aspectRatio?: number;
  tile: RailTile;
  width: DimensionValue;
  /** Drives the size of live overlays and the rank badge. */
  size?: TileSize;
  variant?: TileVariant;
  isPriority?: boolean;
  /** Continue Watching progress, 0 to 1. */
  progress?: number | undefined;
  /** Top 10 position. */
  rank?: number | undefined;
  /** Rails reserve two lines. */
  reservesLabelBlock?: boolean;
  onPress?: (() => void) | undefined;
}

/** Renders a VOD, live, channel, or category tile using its configured presentation. */
export function ContentTile({
  aspectRatio,
  tile,
  width,
  size = "standard",
  variant = TILE_VARIANT.LANDSCAPE,
  isPriority = false,
  progress,
  rank,
  reservesLabelBlock = true,
  onPress,
}: ContentTileProps) {
  const artworkAspectRatio = aspectRatio ?? getTileAspectRatio(variant);
  const imageUrl = pickImageUrlForAspectRatio(tile.media, artworkAspectRatio);
  const showsGenreTreatment =
    tile.contentType === "category" && variant === TILE_VARIANT.SQUARE_CARD;
  const durationLabel =
    variant === TILE_VARIANT.VERTICAL &&
    tile.contentType === "vod" &&
    tile.durationSeconds !== undefined
      ? formatVodTime(tile.durationSeconds)
      : undefined;
  // Screen readers can't read the visual overlays, so say them.
  const accessibilityLabel =
    tile.contentType === "vod"
      ? [
          rank === undefined ? undefined : `Number ${rank}`,
          tile.title,
          tile.channelName,
          durationLabel,
        ]
          .filter((part) => part !== undefined)
          .join(", ")
      : tile.title;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      // Screen readers can't see the bar, so the tile says it, e.g. "40% watched".
      accessibilityValue={
        progress === undefined
          ? undefined
          : { text: `${Math.round(progress * 100)}% watched` }
      }
      onPress={onPress}
      style={{ width }}
    >
      <View
        className="overflow-hidden bg-medium-slate-blue"
        style={{
          aspectRatio: artworkAspectRatio,
          borderRadius: TILE_CORNER_RADIUS,
        }}
      >
        <ProgrammeArtwork
          imageUrl={imageUrl}
          priority={isPriority ? "high" : "normal"}
          transitionMs={TILE_TRANSITION_MS}
        />
        {tile.contentType === "live" ? (
          <LiveOverlays size={size} tile={tile} />
        ) : null}
        {showsGenreTreatment ? <GenreOverlay title={tile.title} /> : null}
        {tile.contentType === "vod" ? (
          <VodOverlays
            progress={progress}
            rank={rank}
            size={size}
            showsDuration={variant === TILE_VARIANT.VERTICAL}
            tile={tile}
          />
        ) : null}
      </View>
      {showsGenreTreatment ? null : (
        <Text
          className="text-oatmeal"
          numberOfLines={TILE_LABEL_LINES}
          style={{
            fontSize: TILE_LABEL_SIZE,
            letterSpacing: TILE_LABEL_LETTER_SPACING,
            lineHeight: TILE_LABEL_LINE_HEIGHT,
            marginTop: TILE_LABEL_MARGIN_TOP,
            ...(reservesLabelBlock && tile.contentType !== "live"
              ? { minHeight: TILE_LABEL_LINE_HEIGHT * TILE_LABEL_LINES }
              : {}),
          }}
          testID="content-tile-title"
          weight="bold"
        >
          {tile.title}
        </Text>
      )}
      {tile.contentType === "live" && tile.timeLabel ? (
        <Text
          className="text-[14px] leading-[18px] text-transparent-white-70"
          numberOfLines={1}
        >
          {tile.timeLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}
