import type { ContentRail } from "@bfbs/common-sdk";
import {
  getContentChannelId,
  getProviderContentType,
  resolveLiveChannelId,
} from "@/features/content-rails/content";
import type {
  ChannelRailTile,
  LiveRailState,
  PageRail,
} from "@/features/content-rails/types";
import { getPageRailConfig } from "@/features/content-rails/utils/rail-config";
import {
  getTileAspectRatio,
  type TilePresentation,
} from "@/features/content-rails/utils/tile-metrics";
import type { LiveChannel } from "@/features/live-channels/types";
import { resolveRailThumbnail } from "@/utils/media";

/**
 * Builds channel rail tiles from placement and channel media, preferring the
 * provider's requested image variant before falling back to any usable image.
 */
function toChannelRailTiles(
  rail: ContentRail,
  channelsById: Map<string, LiveChannel>,
  presentation: TilePresentation,
): ChannelRailTile[] {
  const thumbnailDisplay = rail.contentDisplay?.thumbnailDisplay;
  const seen = new Set<string>();
  const tiles: ChannelRailTile[] = [];

  for (const item of rail.items ?? []) {
    const channelId = getContentChannelId(item);

    if (!channelId || seen.has(channelId)) {
      continue;
    }

    /** The details page only needs the id; live data may not carry it. */
    const channel = channelsById.get(channelId) ?? {
      id: channelId,
      name: item.title,
    };
    const thumbnail = resolveRailThumbnail({
      aspectRatio: getTileAspectRatio(presentation.variant),
      fallbackMedia: channel.media,
      media: item.media,
      thumbnailDisplay,
    });

    seen.add(channelId);
    tiles.push({
      channel,
      id: item.id,
      ...(thumbnail ? { media: thumbnail } : {}),
      name: item.title || channel.name,
    });
  }

  return tiles;
}

function toRailLiveChannels(
  rail: ContentRail,
  channels: LiveChannel[],
  channelsById: Map<string, LiveChannel>,
): LiveChannel[] {
  const seen = new Set<string>();
  const railChannels: LiveChannel[] = [];

  for (const item of rail.items ?? []) {
    const channelId = resolveLiveChannelId(item, channels);
    const channel = channelId ? channelsById.get(channelId) : undefined;

    if (channel && !seen.has(channel.id)) {
      seen.add(channel.id);
      railChannels.push(channel);
    }
  }

  return railChannels;
}

/** Hero channel picks and on-air events, matched to their live channel so the Hero can show what's on now. */
function toHeroLiveChannels(
  rail: ContentRail,
  channelsById: Map<string, LiveChannel>,
): Record<string, LiveChannel> {
  const liveChannels: Record<string, LiveChannel> = {};

  for (const item of rail.items ?? []) {
    const channelId = getContentChannelId(item);
    const channel = channelId ? channelsById.get(channelId) : undefined;
    const isChannelPick = getProviderContentType(item) === "channel";
    // An event counts as live once the guide has it on now, like a channel pick.
    const isEventOnNow = channel?.currentProgramme?.id === item.id;

    if (channel && (isChannelPick || isEventOnNow)) {
      liveChannels[item.id] = channel;
    }
  }

  return liveChannels;
}

/**
 * Adapts SDK rails to the renderer selected by the shared rail configuration.
 */
export function toPageRails(
  rails: ContentRail[],
  liveState: LiveRailState,
): PageRail[] {
  const channelsById = new Map(
    liveState.channels.map((channel) => [channel.id, channel]),
  );

  return rails.flatMap((rail): PageRail[] => {
    const { kind, presentation } = getPageRailConfig(rail);

    switch (kind) {
      case "category-navigation":
      case "content":
      case "promo":
        return [{ id: rail.category.id, kind, placement: rail }];
      case "hero":
        return [
          {
            id: rail.category.id,
            kind,
            liveChannels: toHeroLiveChannels(rail, channelsById),
            placement: rail,
          },
        ];
      case "channels": {
        const tiles = liveState.isLoading
          ? []
          : toChannelRailTiles(rail, channelsById, presentation);

        if (!liveState.isLoading && tiles.length === 0) {
          return [];
        }

        return [
          {
            id: rail.category.id,
            isLoading: liveState.isLoading,
            kind,
            presentation,
            tiles,
            title: rail.category.name,
          },
        ];
      }
      case "hidden":
        return [];
      case "live-channels": {
        const channels = toRailLiveChannels(
          rail,
          liveState.channels,
          channelsById,
        );

        if (channels.length === 0 && !liveState.isLoading) {
          return [];
        }

        return [
          {
            channels,
            error: liveState.error,
            id: rail.category.id,
            isLoading: liveState.isLoading,
            kind,
            presentation,
            title: rail.category.name,
          },
        ];
      }
    }

    kind satisfies never;
    return [];
  });
}
