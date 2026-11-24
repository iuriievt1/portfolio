import type { ContentItem } from "@bfbs/common-sdk";
import type { ViewStyle } from "react-native";
import {
  getContentPlaybackType,
  getProviderContentType,
} from "@/features/content-rails/content";
import type { TileFormFactor } from "@/features/content-rails/types";
import type { LiveChannel } from "@/features/live-channels/types";
import { getTabletMetrics } from "@/features/watch-details/components/watch-details-tablet/tablet-metrics";
import { formatDateAtTime, parseDateMs } from "@/utils/date-time";
import { getProgrammeEndDateTime } from "@/utils/programme";

// Same 16px side gap as other phone screens.
const PHONE_SIDE_INSET = 16;
// Card widths in the Figma tablet frames.
const TABLET_CARD_WIDTH = {
  tabletLandscape: 960,
  tabletPortrait: 741,
};
// The portrait card's share of the Figma portrait frame.
const TABLET_CARD_SHARE =
  TABLET_CARD_WIDTH.tabletPortrait / getTabletMetrics(false).frameWidth;
/** The landscape card: the most a tablet card grows to. */
export const TABLET_CARD_MAX_WIDTH = TABLET_CARD_WIDTH.tabletLandscape;

/**
 * A layout rule, not a JS number, so the card resizes with the rotate:
 * the portrait card's share of the width, capped at the landscape card.
 */
export const TABLET_CARD_SIZE_STYLE: ViewStyle = {
  maxWidth: TABLET_CARD_MAX_WIDTH,
  width: `${TABLET_CARD_SHARE * 100}%`,
};
// Space between cards. On phone, 16 keeps the next card just off screen.
export const HERO_CARD_GAP: Record<TileFormFactor, number> = {
  phone: 16,
  tabletLandscape: 16,
  tabletPortrait: 8,
};

/** Phone: the screen minus the side gaps. Tablet: the width TABLET_CARD_SIZE_STYLE gives. */
export function getHeroCardWidth(
  formFactor: TileFormFactor,
  screenWidth: number,
) {
  if (formFactor === "phone") {
    return screenWidth - PHONE_SIDE_INSET * 2;
  }

  return Math.min(
    screenWidth * TABLET_CARD_SHARE,
    TABLET_CARD_WIDTH.tabletLandscape,
  );
}

/** A channel pick shows what's on now, with the channel attached for its logo. */
export function toLiveHeroItem(
  item: ContentItem,
  channel: LiveChannel,
): ContentItem {
  return channel.currentProgramme
    ? { ...channel.currentProgramme, channel }
    : { ...item, channel, title: channel.name };
}

/** A live event's state from its start and end; undefined for anything else. */
export function getEventState(item: ContentItem, nowMs: number) {
  const startMs = parseDateMs(item.startDateTime);
  const endMs = parseDateMs(getProgrammeEndDateTime(item));

  if (
    getContentPlaybackType(item) !== "live" ||
    startMs === null ||
    endMs === null
  ) {
    return undefined;
  }

  if (nowMs < startMs) {
    return "upcoming";
  }

  return nowMs < endMs ? "live" : "ended";
}

// Same format as "Leaving on 16 October at 15:00".
function getUpcomingLabel(item: ContentItem, timeZone: string | undefined) {
  const startMs = parseDateMs(item.startDateTime);

  if (startMs === null) {
    return undefined;
  }

  return `Watch on ${formatDateAtTime({ timeMs: startMs, timeZone })}`;
}

export type HeroItem = {
  id: string;
  isLive: boolean;
  /** What the card shows: the VOD item, the event, or the channel's current programme. */
  item: ContentItem;
  onPress?: (() => void) | undefined;
  /** "Watch on 11 August at 15:20" for an upcoming event. */
  upcomingLabel?: string | undefined;
};

/** What screen readers say for a card: its title, then Live or when it starts. */
export function getHeroAccessibilityLabel({
  isLive,
  item,
  upcomingLabel,
}: Pick<HeroItem, "isLive" | "item" | "upcomingLabel">) {
  return [item.title, isLive ? "Live" : upcomingLabel]
    .filter(Boolean)
    .join(", ");
}

/** Builds Hero items from the caller's content and live channel data. An event goes once it has ended. */
export function getHeroItems({
  items,
  liveChannels,
  nowMs,
  onContentPress,
  onLivePress,
  timeZone,
}: {
  items: ContentItem[];
  liveChannels: Record<string, LiveChannel>;
  nowMs: number;
  onContentPress?: ((item: ContentItem) => void) | undefined;
  onLivePress?: ((channel: LiveChannel) => void) | undefined;
  timeZone?: string | undefined;
}): HeroItem[] {
  return (
    items
      // An ended event goes, unless the guide still has it on now.
      .filter(
        (item) =>
          getEventState(item, nowMs) !== "ended" ||
          Boolean(liveChannels[item.id]),
      )
      .map((item) => {
        const channel = liveChannels[item.id];

        if (!channel) {
          // An event can't be played until the guide has it on now.
          const isEvent = getEventState(item, nowMs) !== undefined;

          return {
            id: item.id,
            isLive: false,
            item,
            onPress: isEvent ? undefined : () => onContentPress?.(item),
            upcomingLabel: isEvent
              ? getUpcomingLabel(item, timeZone)
              : undefined,
          };
        }

        return {
          id: item.id,
          isLive: true,
          // A channel pick shows what's on now; an event keeps its own Hero details.
          item:
            getProviderContentType(item) === "channel"
              ? toLiveHeroItem(item, channel)
              : item,
          onPress: () => onLivePress?.(channel),
        };
      })
  );
}

/** Like Lightning's Carousel: past the last item is 0, before 0 is the last item. */
export function getItemIndex(cardNumber: number, itemCount: number) {
  return ((cardNumber % itemCount) + itemCount) % itemCount;
}
