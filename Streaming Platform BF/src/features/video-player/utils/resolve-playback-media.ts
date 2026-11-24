import type { PlaySessionData } from "@bfbs/common-sdk";
import { getDrm } from "./get-drm";
import { inferSourceType } from "./infer-source-type";

export function resolvePlaybackMedia(
  playSession: PlaySessionData,
  fairplayCertificateUrl: string | undefined,
) {
  const url = (playSession.manifestUrl ?? playSession.playUrl?.href)?.trim();

  if (!url) {
    throw new Error("Stream URL is missing");
  }

  return {
    drm: getDrm(playSession, fairplayCertificateUrl),
    sourceType: inferSourceType(url),
    url,
  };
}
