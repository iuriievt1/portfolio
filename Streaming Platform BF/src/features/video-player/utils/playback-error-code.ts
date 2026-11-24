import {
  type PlayerError,
  PlayerErrorCode,
  type PlaySessionData,
} from "@bfbs/common-sdk";
import { mapNetworkFailureToCode } from "@/infra/error/map-network-failure";
import {
  getErrorCode,
  getErrorDescription,
  getErrorMessage,
  getErrorStatus,
  hasMatchingTerm,
  isContentUnavailableError,
} from "@/infra/error/utils/classify-error";
import { isUnsupportedDrmForPlatform } from "./drm-type";

export type PlaybackErrorContext = {
  playSession?: PlaySessionData | undefined;
  playSessionError?: unknown;
  playerPlaybackError?: PlayerError | null | undefined;
};

const AUTH_ERROR_TERMS = ["auth", "token", "unauthorised", "unauthorized"];
const REGION_RESTRICTED_ERROR_CODE = "GEO_LOCATION_ERROR";
const REGION_RESTRICTED_ERROR_TERMS = ["geolocation", "cpelocation"];
const CONCURRENCY_LIMIT_ERROR_TERMS = [
  "concurency_limit_exceeded",
  "concurrency_limit_exceeded",
  "concurrent_stream_limit",
];
const DRM_LICENCE_ERROR_TERMS = ["licence", "license"];
const UNSUPPORTED_ERROR_TERMS = [
  "codec",
  "container",
  "format",
  "not supported",
  "unsupported",
];

/** Too vague to trust. */
function isGenericPlayerErrorCode(code: string | undefined) {
  if (!code) {
    return true;
  }

  switch (code) {
    case PlayerErrorCode.PLAYBACK_FAILED:
    case PlayerErrorCode.UNEXPECTED_ERROR:
      return true;
    default:
      return false;
  }
}

/** Synamedia spells the same condition several ways. */
function stripSeparators(value: string | undefined): string | undefined {
  return value?.replace(/[^a-z\d]/gi, "");
}

function isRegionRestrictedError(error: unknown): boolean {
  const code = getErrorCode(error);

  if (code === REGION_RESTRICTED_ERROR_CODE) {
    return true;
  }

  return [getErrorDescription(error), code ? undefined : getErrorMessage(error)]
    .map(stripSeparators)
    .some((value) => hasMatchingTerm(value, REGION_RESTRICTED_ERROR_TERMS));
}

function isConcurrencyLimitError(error: unknown): boolean {
  return [
    getErrorCode(error),
    getErrorDescription(error),
    getErrorMessage(error),
  ].some((value) => hasMatchingTerm(value, CONCURRENCY_LIMIT_ERROR_TERMS));
}

function getSignInErrorCode(error: unknown): string | undefined {
  const code = getErrorCode(error);

  return code?.startsWith("AUTH_") ? code : undefined;
}

function isAuthError(error: unknown): boolean {
  const status = getErrorStatus(error);

  return (
    status === 401 ||
    status === 403 ||
    hasMatchingTerm(getErrorCode(error), AUTH_ERROR_TERMS) ||
    hasMatchingTerm(getErrorMessage(error), AUTH_ERROR_TERMS)
  );
}

function matchesPlayerError(
  error: PlayerError | null | undefined,
  terms: string[],
): boolean {
  if (!error) {
    return false;
  }

  return (
    hasMatchingTerm(error.errorDescription, terms) ||
    hasMatchingTerm(getErrorCode(error.providerError), terms) ||
    hasMatchingTerm(getErrorMessage(error.providerError), terms)
  );
}

/** Classifies a playback failure client-side. */
export function mapPlaybackErrorToCode({
  playSession,
  playSessionError,
  playerPlaybackError,
}: PlaybackErrorContext): string {
  if (
    playerPlaybackError &&
    !isGenericPlayerErrorCode(playerPlaybackError.errorCode)
  ) {
    return playerPlaybackError.errorCode;
  }

  if (isUnsupportedDrmForPlatform(playSession)) {
    return PlayerErrorCode.DEVICE_NOT_SUPPORTED;
  }

  if (matchesPlayerError(playerPlaybackError, DRM_LICENCE_ERROR_TERMS)) {
    return PlayerErrorCode.PLAYBACK_AUTHORISATION_FAILED;
  }

  if (matchesPlayerError(playerPlaybackError, UNSUPPORTED_ERROR_TERMS)) {
    return PlayerErrorCode.FORMAT_NOT_SUPPORTED;
  }

  const networkFailureCode = mapNetworkFailureToCode(playSessionError);

  if (networkFailureCode) {
    return networkFailureCode;
  }

  if (isRegionRestrictedError(playSessionError)) {
    return PlayerErrorCode.REGION_RESTRICTED;
  }

  if (isConcurrencyLimitError(playSessionError)) {
    return PlayerErrorCode.TOO_MANY_DEVICES;
  }

  const signInErrorCode = getSignInErrorCode(playSessionError);

  if (signInErrorCode) {
    return signInErrorCode;
  }

  if (isAuthError(playSessionError)) {
    return PlayerErrorCode.PLAYBACK_AUTHORISATION_FAILED;
  }

  if (isContentUnavailableError(playSessionError)) {
    return PlayerErrorCode.CONTENT_UNAVAILABLE;
  }

  return PlayerErrorCode.PLAYBACK_FAILED;
}
