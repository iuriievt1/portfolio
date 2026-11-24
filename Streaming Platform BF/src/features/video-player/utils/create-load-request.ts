import type { PlaybackLoadRequest, PlaybackSourceType } from "@bfbs/common-sdk";
import { PlaybackSourceType as SourceType } from "@bfbs/common-sdk";
import { Platform } from "react-native";
import type { VideoSource } from "@/features/video-player/types";

type LoadRequestInput = {
  drm?: PlaybackLoadRequest["drm"];
  posterUrl?: PlaybackLoadRequest["posterUrl"];
  sessionId?: PlaybackLoadRequest["sessionId"];
  sourceType: PlaybackSourceType;
  startPositionSeconds?: PlaybackLoadRequest["startPositionSeconds"];
  title: string;
  url: string;
};

type LoadRequestSource = Pick<
  VideoSource,
  | "drm"
  | "posterUrl"
  | "playSession"
  | "sourceType"
  | "startPositionSeconds"
  | "title"
  | "url"
>;

export function createLoadRequest(
  input: LoadRequestInput,
): PlaybackLoadRequest {
  return {
    autoplay: true,
    sourceType: input.sourceType,
    title: input.title,
    url: input.url,
    ...(input.drm ? { drm: input.drm } : {}),
    ...(input.posterUrl ? { posterUrl: input.posterUrl } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(typeof input.startPositionSeconds === "number" &&
    input.startPositionSeconds >= 0
      ? { startPositionSeconds: input.startPositionSeconds }
      : {}),
  };
}

export function sourceToLoadRequest(
  source: LoadRequestSource,
): PlaybackLoadRequest {
  return createLoadRequest({
    drm: source.drm,
    posterUrl: source.posterUrl,
    sessionId: source.playSession?.id,
    sourceType: source.sourceType,
    startPositionSeconds: source.startPositionSeconds,
    title: source.title,
    url: source.url,
  });
}

export function isUnsupportedSourceForPlatform(
  sourceType: PlaybackSourceType | undefined,
) {
  return Platform.OS === "ios" && sourceType === SourceType.DASH;
}
