import type { ContentRail, MediaImage } from "@bfbs/common-sdk";

import type { TilePresentation } from "@/features/content-rails/utils/tile-metrics";
import type { LiveChannel } from "@/features/live-channels/types";
import type { RailThumbnail } from "@/utils/media";

export type TileSize = "large" | "standard";

type LivePageRailDefinition = {
  id: string;
  kind: "live-channels";
  presentation: TilePresentation;
  title: string;
};

type ChannelsPageRailDefinition = {
  id: string;
  kind: "channels";
  presentation: TilePresentation;
  title: string;
};

type ContentPageRail = {
  id: string;
  kind: "content";
  placement: ContentRail;
};

type CategoryNavigationPageRail = {
  id: string;
  kind: "category-navigation";
  placement: ContentRail;
};

type PromoPageRail = {
  id: string;
  kind: "promo";
  placement: ContentRail;
};

type HeroPageRail = {
  id: string;
  kind: "hero";
  liveChannels: Record<string, LiveChannel>;
  placement: ContentRail;
};

export type LiveRailState = {
  channels: LiveChannel[];
  error: string | null;
  isLoading: boolean;
};

/** A channels rail tile: image from the rail item, channel only for the route. */
export type ChannelRailTile = {
  channel: LiveChannel;
  id: string;
  media?: RailThumbnail;
  name: string;
};

export type ChannelsRailState = {
  isLoading: boolean;
  tiles: ChannelRailTile[];
};

export type PageRail =
  | CategoryNavigationPageRail
  | (LivePageRailDefinition & LiveRailState)
  | (ChannelsPageRailDefinition & ChannelsRailState)
  | ContentPageRail
  | HeroPageRail
  | PromoPageRail;

export type TileFormFactor = "phone" | "tabletPortrait" | "tabletLandscape";

type BaseRailTile = {
  id: string;
  media?: MediaImage[];
  title: string;
};

export type VodRailTile = BaseRailTile & {
  /** Channel badge. */
  channelMedia?: MediaImage[];
  channelName?: string;
  contentType: "vod";
  durationSeconds?: number;
};

export type CategoryNavigationRailTile = BaseRailTile & {
  categoryId: string;
  contentType: "category";
};

export type ChannelNavigationRailTile = BaseRailTile & {
  contentType: "channel";
};

export type LiveRailTile = BaseRailTile & {
  /** Channel branding, shown as a badge over the programme artwork. */
  channelMedia?: MediaImage[];
  channelName: string;
  contentType: "live";
  /**
   * The programme's window, not a progress value: the tile ticks its own bar so
   * a passing second does not rebuild the rail's data.
   */
  progressEndMs?: number;
  progressStartMs?: number;
  timeLabel?: string;
};

export type RailTile =
  | CategoryNavigationRailTile
  | ChannelNavigationRailTile
  | LiveRailTile
  | VodRailTile;
