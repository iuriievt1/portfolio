import type { PlaySessionData } from "@bfbs/common-sdk";
import { isDevice } from "expo-device";
import { Platform } from "react-native";

/** DRM schemes Synamedia reports. */
export const DRM_TYPE = {
  fairplay: "fpDrm",
  widevine: "wvDrm",
} as const;

export function isFairplaySession(playSession: PlaySessionData | undefined) {
  return playSession?.drmType === DRM_TYPE.fairplay;
}

/** iOS plays FairPlay, Android Widevine. */
export function isUnsupportedDrmForPlatform(
  playSession: PlaySessionData | undefined,
) {
  if (playSession?.drmType === DRM_TYPE.widevine) {
    return Platform.OS === "ios";
  }

  if (playSession?.drmType === DRM_TYPE.fairplay) {
    return Platform.OS === "android" || (Platform.OS === "ios" && !isDevice);
  }

  return false;
}
