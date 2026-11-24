import {
  type Channel,
  type ContentItem,
  type ContentRail,
  isCategoryNavigationItem,
} from "@bfbs/common-sdk";
import {
  getTilePresentation,
  TILE_VARIANT,
} from "@/features/content-rails/utils/tile-metrics";
import type { LiveChannel } from "@/features/live-channels";

export type ContentPlaybackType = "live" | "vod";
export type ContentTileType = "channel" | ContentPlaybackType;
export type ContentItemPressHandlers = {
  onCategory: (categoryId: string) => void;
  onChannel: (channel: Channel) => void;
  onLive: (channelId: string) => void;
  onShow: (showId: string) => void;
  onVod: (item: ContentItem) => void;
};

type RailItemPressHandlers = {
  onDirectVod: (item: ContentItem) => void;
  onItem: (item: ContentItem) => void;
};

const PROVIDER_CONTENT_TYPES = [
  "standalone",
  "linearStandalone",
  "vod",
  "episode",
  "season",
  "show",
  "group",
  "channel",
] as const;

export type ProviderContentType = (typeof PROVIDER_CONTENT_TYPES)[number];

const providerContentTypeByNormalizedValue = new Map<
  string,
  ProviderContentType
>(
  PROVIDER_CONTENT_TYPES.map((contentType) => [
    contentType.toLowerCase(),
    contentType,
  ]),
);

function normaliseProviderContentType(
  contentType: ContentItem["contentType"],
): ProviderContentType | undefined {
  return typeof contentType === "string"
    ? providerContentTypeByNormalizedValue.get(contentType.toLowerCase())
    : undefined;
}

/** Resolves the typed provider content type used by catalogue responses. */
export function getProviderContentType(
  item: Pick<ContentItem, "contentType">,
): ProviderContentType | undefined {
  return normaliseProviderContentType(item.contentType);
}

/** Resolves the item's channel id. */
export function getContentChannelId(
  item: Pick<ContentItem, "channel" | "channelId" | "contentType" | "id">,
): string | undefined {
  return (
    item.channelId ??
    item.channel?.id ??
    (getProviderContentType(item) === "channel" ? item.id : undefined)
  );
}

/** Resolves duration variants returned by supported catalogue providers. */
export function getContentDurationSeconds(
  item:
    | Pick<
        ContentItem,
        | "contentDurationSeconds"
        | "durationSeconds"
        | "streamingDurationSeconds"
      >
    | undefined,
): number | undefined {
  return (
    item?.durationSeconds ??
    item?.contentDurationSeconds ??
    item?.streamingDurationSeconds
  );
}

/** Classifies an item for playback. */
export function getContentPlaybackType(
  item: ContentItem,
): ContentPlaybackType | undefined {
  if (item.externalViewingOptions?.externalOnly === true) {
    return undefined;
  }

  const contentType = getProviderContentType(item);

  switch (contentType) {
    case "channel":
    case "linearStandalone":
      return "live";
    case "episode":
      return getContentChannelId(item) ? "live" : undefined;
    case "standalone":
    case "vod":
      return "vod";
    default:
      return undefined;
  }
}

/** True when a vertical-rail item should bypass details and start playback. */
function shouldPlayRailItemDirectly(
  rail: Pick<ContentRail, "template">,
  item: ContentItem,
): boolean {
  return (
    getTilePresentation(rail.template).variant === TILE_VARIANT.VERTICAL &&
    getContentPlaybackType(item) === "vod"
  );
}

/** Applies rail-specific playback before delegating to the normal item action. */
export function handleRailItemPress(
  rail: Pick<ContentRail, "template">,
  item: ContentItem,
  { onDirectVod, onItem }: RailItemPressHandlers,
): void {
  if (shouldPlayRailItemDirectly(rail, item)) {
    onDirectVod(item);
    return;
  }

  onItem(item);
}

/** Classifies supported catalogue content without conflating its tile presentation. */
export function getContentTileType(
  item: ContentItem,
): ContentTileType | undefined {
  if (item.externalViewingOptions?.externalOnly === true) {
    return undefined;
  }

  const contentType = getProviderContentType(item);

  if (contentType === "channel") {
    return "channel";
  }

  return (
    getContentPlaybackType(item) ??
    (contentType === "episode" ||
    contentType === "season" ||
    contentType === "show"
      ? "vod"
      : undefined)
  );
}

/** The show a VOD series item belongs to, so it can open the series page; undefined for anything else. */
export function getSeriesShowId(
  item: Pick<
    ContentItem,
    "channel" | "channelId" | "contentType" | "id" | "showId"
  >,
): string | undefined {
  switch (getProviderContentType(item)) {
    case "show":
      // Some lists add a "~vod" suffix to a show's id; showId is the plain one.
      return item.showId ?? item.id;
    case "season":
      return item.showId;
    case "episode":
      // An episode airing on a channel plays live instead.
      return getContentChannelId(item) ? undefined : item.showId;
    default:
      return undefined;
  }
}

/** Routes a provider content item through the shared content press rules. */
export function handleContentItemPress(
  item: ContentItem,
  channels: LiveChannel[],
  handlers: ContentItemPressHandlers,
): void {
  if (isCategoryNavigationItem(item)) {
    handlers.onCategory(item.categoryId);
    return;
  }

  const contentType = getProviderContentType(item);

  if (contentType === "channel") {
    handlers.onChannel({
      id: item.id,
      ...(item.media ? { media: item.media } : {}),
      name: item.title,
    });
    return;
  }

  const showId = getSeriesShowId(item);
  const isEpisode = contentType === "episode";

  if (showId && !isEpisode) {
    handlers.onShow(showId);
    return;
  }

  const channelId = resolveLiveChannelId(item, channels);

  if (channelId) {
    handlers.onLive(channelId);
    return;
  }

  if (showId) {
    handlers.onShow(showId);
    return;
  }

  if (getContentPlaybackType(item) === "vod") {
    handlers.onVod(item);
  }
}

/** Classifies a rail for playback. */
export function getRailPlaybackType(
  rail: Pick<ContentRail, "items">,
): ContentPlaybackType | undefined {
  let liveCount = 0;
  let vodCount = 0;

  for (const item of rail.items ?? []) {
    const tileType = getContentTileType(item);
    const type = tileType === "channel" ? "live" : tileType;

    if (type === "live") {
      liveCount += 1;
    } else if (type === "vod") {
      vodCount += 1;
    }
  }

  if (liveCount > 0 && liveCount >= vodCount) {
    return "live";
  }

  return vodCount > 0 ? "vod" : undefined;
}

/** Resolves a live programme's channel. */
export function resolveLiveChannelId(
  item: ContentItem,
  channels: LiveChannel[],
): string | undefined {
  const directChannelId = getContentChannelId(item);

  if (directChannelId) {
    return directChannelId;
  }

  const airingChannel = channels.find(
    (channel) =>
      channel.currentProgramme?.id === item.id ||
      channel.nextProgramme?.id === item.id,
  );

  return airingChannel?.id;
}
