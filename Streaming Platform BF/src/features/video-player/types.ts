import type {
  ContentAdvisory,
  ContentItem,
  ContentParentalRating,
  PlaybackLoadRequest,
  PlaybackSourceType,
  PlaySessionData,
} from "@bfbs/common-sdk";

export type LiveProgramme = {
  endsAt: string;
  id: string;
  startsAt: string;
  title: string;
};

export type SeekRequest = {
  isFinalSeek?: boolean;
  progress: number;
};

export type VideoSource = PlaybackLoadRequest & {
  channelId?: string;
  channelTitle?: string;
  isMockLivePlayer?: boolean;
  playSession?: PlaySessionData;
  programme?: LiveProgramme;
  timeZone?: string;
  url: string;
  sourceType: PlaybackSourceType;
  title: string;
};

export type VodVideoSource = PlaybackLoadRequest & {
  contentAdvisories?: ContentAdvisory[];
  durationSeconds?: number;
  episodeNumber?: ContentItem["episodeNumber"];
  episodeTitle?: ContentItem["episodeTitle"];
  parentalRating?: ContentParentalRating;
  playSession?: PlaySessionData;
  seasonNumber?: ContentItem["seasonNumber"];
  sourceType: PlaybackSourceType;
  title: string;
  url: string;
};

export type VodAsset = {
  durationSeconds?: number;
  id: string;
  title: string;
};

export type VideoPlayerProps = {
  onProgrammeBoundary?: () => void;
  onOpenMiniGuide?: () => void;
  visible: boolean;
  onClose: () => void;
  source?: VideoSource | undefined;
};
