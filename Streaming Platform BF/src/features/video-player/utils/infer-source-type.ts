import { PlaybackSourceType } from "@bfbs/common-sdk";

export function inferSourceType(url: string) {
  return url.includes(".mpd")
    ? PlaybackSourceType.DASH
    : PlaybackSourceType.HLS;
}
