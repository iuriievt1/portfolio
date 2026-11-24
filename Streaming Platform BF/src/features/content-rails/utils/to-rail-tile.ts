import { type ContentItem, isCategoryNavigationItem } from "@bfbs/common-sdk";
import { getContentTileType } from "@/features/content-rails/content";
import type {
  CategoryNavigationRailTile,
  ChannelNavigationRailTile,
  RailTile,
} from "@/features/content-rails/types";
import { toVodTile } from "@/features/content-rails/utils/to-vod-tile";
import { toLiveTile } from "@/features/live-channels";

/** Maps a supported provider content item onto its presentation-neutral tile. */
export function toRailTile(
  item: ContentItem,
  timeZone: string,
): RailTile | undefined {
  if (isCategoryNavigationItem(item)) {
    return {
      categoryId: item.categoryId,
      contentType: "category",
      id: item.id,
      ...(item.media ? { media: item.media } : {}),
      title: item.title,
    } satisfies CategoryNavigationRailTile;
  }

  const tileType = getContentTileType(item);

  if (tileType === "vod") {
    return toVodTile(item);
  }

  if (tileType === "channel") {
    return {
      contentType: "channel",
      id: item.id,
      ...(item.media ? { media: item.media } : {}),
      title: item.title,
    } satisfies ChannelNavigationRailTile;
  }

  if (tileType !== "live") {
    return undefined;
  }

  return toLiveTile(
    {
      id: item.channel?.id ?? item.channelId ?? item.id,
      ...(item.channel?.media ? { media: item.channel.media } : {}),
      name: item.channel?.name ?? item.title,
      currentProgramme: item,
    },
    timeZone,
  );
}
