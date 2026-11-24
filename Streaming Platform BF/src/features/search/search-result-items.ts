import type { ContentItem } from "@bfbs/common-sdk";

import {
  getProviderContentType,
  resolveLiveChannelId,
} from "@/features/content-rails/content";
import type { RailTile } from "@/features/content-rails/types";
import { toVodTile } from "@/features/content-rails/utils/to-vod-tile";
import type { LiveChannel } from "@/features/live-channels";
import { toLiveTile } from "@/features/live-channels";
import { getDeviceTimeZone, parseDateMs } from "@/utils/date-time";
import { SEARCH_RESULTS_LIMIT } from "./search-results";

export type SearchResultCategory =
  | "currentVod"
  | "liveChannel"
  | "liveEvent"
  | "futureVod";

export type SearchResultDestination =
  | { kind: "live"; channelId: string }
  | { kind: "show"; showId: string }
  | { kind: "vod"; assetId: string };

export type SearchResultItem = {
  category: SearchResultCategory;
  destination: SearchResultDestination;
  key: string;
  tile: RailTile;
};

type Candidate = SearchResultItem & {
  identity: string;
  representationPriority: number;
};

const CATEGORY_PRIORITY: SearchResultCategory[] = [
  "currentVod",
  "liveChannel",
  "liveEvent",
  "futureVod",
];

function createLiveChannel(
  item: ContentItem,
  channels: LiveChannel[],
  contentType: "channel" | "episode" | "linearStandalone",
): LiveChannel | undefined {
  const channelId = resolveLiveChannelId(item, channels);

  if (!channelId) {
    return undefined;
  }

  const knownChannel = channels.find((channel) => channel.id === channelId);

  if (contentType === "channel") {
    return (
      knownChannel ?? {
        id: channelId,
        ...(item.media ? { media: item.media } : {}),
        name: item.title,
      }
    );
  }

  return {
    ...(knownChannel ?? {
      id: channelId,
      ...(item.channel?.media ? { media: item.channel.media } : {}),
      name: item.channel?.name ?? item.title,
    }),
    currentProgramme: item,
  };
}

function toChannelTile(channel: LiveChannel, item: ContentItem): RailTile {
  const media = channel.media ?? item.media;

  return {
    contentType: "channel",
    id: channel.id,
    ...(media ? { media } : {}),
    title: channel.name,
  };
}

// A series result opens the show page when it knows its show.
function toSeriesDestination(
  showId: string | undefined,
  assetId: string,
): SearchResultDestination {
  return showId ? { kind: "show", showId } : { assetId, kind: "vod" };
}

function createVodCandidate(
  item: ContentItem,
  category: "currentVod" | "futureVod",
  destination: SearchResultDestination,
  identity: string,
  representationPriority: number,
): Candidate {
  return {
    category,
    destination,
    identity,
    key: `${category}:${identity}`,
    representationPriority,
    tile: toVodTile(item),
  };
}

function classifySearchResult(
  item: ContentItem,
  channels: LiveChannel[],
  nowMs: number,
  timeZone: string,
): Candidate | undefined {
  if (item.externalViewingOptions?.externalOnly === true) {
    return undefined;
  }

  const contentType = getProviderContentType(item);

  if (contentType === "channel") {
    const channel = createLiveChannel(item, channels, contentType);

    return channel
      ? {
          category: "liveChannel",
          destination: { channelId: channel.id, kind: "live" },
          identity: `channel:${channel.id}`,
          key: `liveChannel:channel:${channel.id}`,
          representationPriority: 1,
          tile: toChannelTile(channel, item),
        }
      : undefined;
  }

  if (contentType === "linearStandalone" || contentType === "episode") {
    const channel = createLiveChannel(item, channels, contentType);

    if (channel) {
      return {
        category: "liveEvent",
        destination: { channelId: channel.id, kind: "live" },
        identity: `event:${item.id}`,
        key: `liveEvent:event:${item.id}`,
        representationPriority: 1,
        tile: toLiveTile(channel, timeZone),
      };
    }

    if (contentType === "linearStandalone") {
      return undefined;
    }
  }

  if (contentType === "show") {
    // Some lists add a "~vod" suffix to a show's id; showId is the plain one.
    const showId = item.showId ?? item.id;

    return createVodCandidate(
      item,
      "currentVod",
      { kind: "show", showId },
      `show:${showId}`,
      3,
    );
  }

  if (contentType === "season") {
    const destination = toSeriesDestination(item.showId, item.id);
    const identity = item.showId ? `show:${item.showId}` : `season:${item.id}`;

    return createVodCandidate(item, "currentVod", destination, identity, 2);
  }

  if (contentType === "episode") {
    const assetId = item.showId ?? item.seasonId;

    if (!assetId) {
      return undefined;
    }

    const identity = item.showId
      ? `show:${item.showId}`
      : `season:${item.seasonId}`;

    return createVodCandidate(
      item,
      "currentVod",
      toSeriesDestination(item.showId, assetId),
      identity,
      1,
    );
  }

  if (contentType === "standalone" || contentType === "vod") {
    const availableSinceMs = parseDateMs(item.availableSinceDateTime);
    const category =
      availableSinceMs !== null && availableSinceMs > nowMs
        ? "futureVod"
        : "currentVod";

    return createVodCandidate(
      item,
      category,
      { assetId: item.id, kind: "vod" },
      `vod:${item.id}`,
      1,
    );
  }

  return undefined;
}

/**
 * Filters, groups, and deduplicates provider results into the product-defined
 * search priority while preserving the provider order inside each group.
 */
export function prepareSearchResultItems({
  channels,
  items,
  nowMs,
  timeZone = getDeviceTimeZone(),
}: {
  channels: LiveChannel[];
  items: ContentItem[];
  nowMs: number;
  timeZone?: string;
}): SearchResultItem[] {
  const buckets = new Map<SearchResultCategory, Candidate[]>(
    CATEGORY_PRIORITY.map((category) => [category, []]),
  );
  const candidatePositions = new Map<
    string,
    { bucket: Candidate[]; index: number }
  >();

  for (const item of items) {
    const candidate = classifySearchResult(item, channels, nowMs, timeZone);

    if (!candidate) {
      continue;
    }

    const dedupeKey = `${candidate.category}:${candidate.identity}`;
    const existing = candidatePositions.get(dedupeKey);

    if (existing) {
      const previous = existing.bucket[existing.index];

      if (
        previous &&
        candidate.representationPriority > previous.representationPriority
      ) {
        existing.bucket[existing.index] = candidate;
      }

      continue;
    }

    const bucket = buckets.get(candidate.category);

    if (!bucket) {
      continue;
    }

    candidatePositions.set(dedupeKey, { bucket, index: bucket.length });
    bucket.push(candidate);
  }

  return CATEGORY_PRIORITY.flatMap((category) => buckets.get(category) ?? [])
    .slice(0, SEARCH_RESULTS_LIMIT)
    .map(
      ({ identity: _identity, representationPriority: _priority, ...item }) =>
        item,
    );
}
