import type { ContentItem } from "@bfbs/common-sdk";
import { getContentDurationSeconds } from "@/features/content-rails/content";
import type { VodRailTile } from "@/features/content-rails/types";

/** Maps a provider content item onto the tile shape. */
export function toVodTile(item: ContentItem): VodRailTile {
  const durationSeconds = getContentDurationSeconds(item);

  return {
    contentType: "vod",
    id: item.id,
    ...(item.channel?.media ? { channelMedia: item.channel.media } : {}),
    ...(item.channel?.name ? { channelName: item.channel.name } : {}),
    ...(durationSeconds === undefined ? {} : { durationSeconds }),
    ...(item.media ? { media: item.media } : {}),
    title: item.title,
  };
}
