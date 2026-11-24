import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components";
import {
  getTileAspectRatio,
  TILE_VARIANT,
  type TileVariant,
} from "@/features/content-rails/utils/tile-metrics";
import type { RailThumbnail } from "@/utils/media";

/** Long channel names wrap rather than stretch the tile. */
const NAME_LINES = 2;

interface ChannelTileProps {
  media?: RailThumbnail;
  name: string;
  width: number;
  onImageError: (imageUrl: string) => void;
  onPress?: (() => void) | undefined;
  variant?: TileVariant;
}

/**
 * Channel tile whose selected media fills the rail's square or landscape frame.
 */
export function ChannelTile({
  media,
  name,
  width,
  onImageError,
  onPress,
  variant = TILE_VARIANT.SQUARE_CARD,
}: ChannelTileProps) {
  return (
    <Pressable
      accessibilityLabel={name}
      accessibilityRole="button"
      onPress={onPress}
      style={{ width }}
    >
      <View
        className="items-center justify-center overflow-hidden rounded-lg bg-medium-slate-blue"
        style={{ aspectRatio: getTileAspectRatio(variant) }}
        testID="channel-tile-media-frame"
      >
        {media ? (
          <Image
            cachePolicy="memory-disk"
            contentFit={media.contentFit}
            onError={() => onImageError(media.url)}
            recyclingKey={media.url}
            source={media.url}
            style={StyleSheet.absoluteFill}
            testID="channel-tile-image"
          />
        ) : (
          <Text
            className="px-2 text-center text-[14px] leading-[18px] text-white"
            numberOfLines={NAME_LINES}
            testID="channel-tile-name"
            weight="semibold"
          >
            {name}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
