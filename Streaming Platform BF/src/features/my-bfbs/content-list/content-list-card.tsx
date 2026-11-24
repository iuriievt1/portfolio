import type { ContentItem } from "@bfbs/common-sdk";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ProgrammeArtwork, Text } from "@/components";
import {
  getTileAspectRatio,
  TILE_CORNER_RADIUS,
  toVodTile,
  VodOverlays,
} from "@/features/content-rails";
import { pickProgrammeImageUrl } from "@/utils/media";

type ContentListCardProps = {
  // Spoken after the title, e.g. "40% watched".
  accessibilityValue?: string | undefined;
  artworkWidth: number;
  // Extra lines under the title, e.g. an episode's duration.
  children?: ReactNode;
  // Under the artwork row, inside the same tap target.
  footer?: ReactNode;
  // A 14px title and an 8px gap, e.g. episodes on phone.
  isCompact?: boolean;
  item: ContentItem;
  // Shown in place of the item's title.
  label?: string;
  onPress: () => void;
  // Drawn over the artwork, e.g. a progress bar.
  overlay?: ReactNode;
};

// One list item: artwork with its channel logo, and the title beside it.
export function ContentListCard({
  accessibilityValue,
  artworkWidth,
  children,
  footer,
  isCompact = false,
  item,
  label = item.title,
  onPress,
  overlay,
}: ContentListCardProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityValue={
        accessibilityValue ? { text: accessibilityValue } : undefined
      }
      className="gap-2"
      onPress={onPress}
    >
      <View
        className={`flex-row items-center ${isCompact ? "gap-2" : "gap-4"}`}
      >
        <View
          className="overflow-hidden bg-medium-slate-blue"
          style={{
            aspectRatio: getTileAspectRatio(),
            borderRadius: TILE_CORNER_RADIUS,
            width: artworkWidth,
          }}
        >
          <ProgrammeArtwork
            imageUrl={pickProgrammeImageUrl(item.media)}
            priority="normal"
          />
          <VodOverlays tile={toVodTile(item)} />
          {overlay}
        </View>
        <View className="flex-1 gap-2">
          <Text
            className={`font-euclid-bold text-white ${
              isCompact ? "text-[14px]" : "text-[16px]"
            }`}
            numberOfLines={2}
          >
            {label}
          </Text>
          {children}
        </View>
      </View>
      {footer}
    </Pressable>
  );
}
