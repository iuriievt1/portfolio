import type {
  PlaybackDrmConfig,
  PlaybackDrmLicenseConfig,
  PlaySessionData,
} from "@bfbs/common-sdk";
import { DRM_TYPE } from "./drm-type";

/** DRM config for the session, or undefined for a clear stream. */
export function getDrm(
  playSession: PlaySessionData,
  fairplayCertificateUrl?: string,
): PlaybackDrmConfig | undefined {
  const { drmProperties, drmType } = playSession;

  if (!drmProperties) {
    return undefined;
  }

  const license: PlaybackDrmLicenseConfig = {
    licenseUrl: drmProperties.laUrl ?? "",
  };

  if (drmProperties.blob) {
    license.headers = { Authorization: `Bearer ${drmProperties.blob}` };
  }

  if (drmType === DRM_TYPE.widevine) {
    return { widevine: license };
  }

  if (drmType === DRM_TYPE.fairplay) {
    return {
      fairplay: {
        ...license,
        ...(fairplayCertificateUrl
          ? { certificateUrl: fairplayCertificateUrl }
          : {}),
      },
    };
  }

  return undefined;
}
