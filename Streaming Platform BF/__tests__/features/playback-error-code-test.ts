import type { PlayerError, PlaySessionData } from "@bfbs/common-sdk";
import { PlayerErrorCode } from "@bfbs/common-sdk";
import { Platform } from "react-native";

let mockIsDevice = true;

jest.mock("expo-device", () => ({
  get isDevice() {
    return mockIsDevice;
  },
}));

import { mapPlaybackErrorToCode } from "@/features/video-player/utils/playback-error-code";
import { setDeviceOffline } from "@/infra/error/connectivity-store";
import { errorCodes } from "@/infra/error/error-codes";

const playSession: PlaySessionData = {
  close: async () => {},
  drmType: "none",
  id: "session-1",
  startKeepAlive: () => {},
  stopKeepAlive: () => {},
};

/**
 * Mirrors `SynamediaGoApiError` without importing it: the SDK's `clients`
 * barrel pulls in `ky`, which Jest does not transform.
 */
function createApiError({
  code,
  description,
  status,
  statusText,
}: {
  code?: string;
  description?: string;
  status: number;
  statusText: string;
}) {
  const codeSuffix = code ? `: ${code}` : "";
  const descriptionSuffix = description ? ` - ${description}` : "";

  return Object.assign(
    new Error(
      `Synamedia Go request failed with ${status} ${statusText}${codeSuffix}${descriptionSuffix}`,
    ),
    { code, description, status },
  );
}

/** The exact shape Synamedia returns for a geo restriction (see issue #101). */
function createRegionRestrictedError() {
  return createApiError({
    code: "GEO_LOCATION_ERROR",
    description: "EStreamingGeoLocationError: 602-UNSUPPORTED_CPE_LOCATION",
    status: 403,
    statusText: "",
  });
}

/** The response observed from Synamedia when the household stream limit is reached. */
function createConcurrencyLimitError() {
  return createApiError({
    code: "CONCURENCY_LIMIT_EXCEEDED",
    description:
      "EStreamingConcurencyLimit: 603-CONCURRENT_STREAM_LIMIT_HOUSEHOLD",
    status: 403,
    statusText: "",
  });
}

const originalPlatformOs = Platform.OS;

function setPlatform(os: "android" | "ios") {
  Object.defineProperty(Platform, "OS", { configurable: true, value: os });
}

describe("mapPlaybackErrorToCode", () => {
  beforeEach(() => {
    mockIsDevice = true;
  });

  afterEach(() => {
    setDeviceOffline(false);
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOs,
    });
  });

  test("maps a dropped request to the server-unavailable code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: new TypeError("Network request failed"),
      }),
    ).toBe(PlayerErrorCode.SERVER_UNAVAILABLE);
  });

  test("maps the transport error ky reports to the server-unavailable code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: Object.assign(
          new Error(
            "Request failed due to a network error: GET https://go.synamedia.com/playSession",
          ),
          { name: "NetworkError" },
        ),
      }),
    ).toBe(PlayerErrorCode.SERVER_UNAVAILABLE);
  });

  test("maps a blocking gateway to the server-unavailable code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: createApiError({
          status: 502,
          statusText: "Bad Gateway",
        }),
      }),
    ).toBe(PlayerErrorCode.SERVER_UNAVAILABLE);

    expect(
      mapPlaybackErrorToCode({
        playSessionError: createApiError({
          status: 503,
          statusText: "Service Unavailable",
        }),
      }),
    ).toBe(PlayerErrorCode.SERVER_UNAVAILABLE);
  });

  test("reads the status of a raw ky response failure", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: Object.assign(new Error("Request failed"), {
          response: { status: 502 },
        }),
      }),
    ).toBe(PlayerErrorCode.SERVER_UNAVAILABLE);
  });

  test("maps a delayed host to the timed-out code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: Object.assign(
          new Error(
            "Request timed out: GET https://go.synamedia.com/personal/clientToken",
          ),
          { name: "TimeoutError" },
        ),
      }),
    ).toBe(errorCodes.timedOut);

    expect(
      mapPlaybackErrorToCode({
        playSessionError: createApiError({
          status: 504,
          statusText: "Gateway Timeout",
        }),
      }),
    ).toBe(errorCodes.timedOut);
  });

  test("maps a page served in place of the API to the server-unavailable code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: new SyntaxError(
          "JSON Parse error: Unexpected character: <",
        ),
      }),
    ).toBe(PlayerErrorCode.SERVER_UNAVAILABLE);
  });

  test("keeps the offline code while the device has no connection", () => {
    setDeviceOffline(true);

    expect(
      mapPlaybackErrorToCode({
        playSessionError: new TypeError("Network request failed"),
      }),
    ).toBe(PlayerErrorCode.NETWORK_OFFLINE);
  });

  test("maps Widevine on iOS to the device-not-supported code", () => {
    setPlatform("ios");

    expect(
      mapPlaybackErrorToCode({
        playSession: { ...playSession, drmType: "wvDrm" },
      }),
    ).toBe(PlayerErrorCode.DEVICE_NOT_SUPPORTED);
  });

  test("leaves FairPlay on a physical iOS device alone", () => {
    setPlatform("ios");

    expect(
      mapPlaybackErrorToCode({
        playSession: { ...playSession, drmType: "fpDrm" },
        playSessionError: { status: 404 },
      }),
    ).toBe(PlayerErrorCode.CONTENT_UNAVAILABLE);
  });

  test("maps FairPlay on an iOS simulator to device not supported", () => {
    mockIsDevice = false;
    setPlatform("ios");

    expect(
      mapPlaybackErrorToCode({
        playSession: { ...playSession, drmType: "fpDrm" },
      }),
    ).toBe(PlayerErrorCode.DEVICE_NOT_SUPPORTED);
  });

  test("honours a stream limit reported by the player", () => {
    expect(
      mapPlaybackErrorToCode({
        playSession,
        playerPlaybackError: {
          errorCode: PlayerErrorCode.TOO_MANY_DEVICES,
          errorDescription: "Concurrency limit reached",
          position: 0,
          sessionId: "",
        },
      }),
    ).toBe(PlayerErrorCode.TOO_MANY_DEVICES);
  });

  test("maps the Synamedia household stream-limit response", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: createConcurrencyLimitError(),
      }),
    ).toBe(PlayerErrorCode.TOO_MANY_DEVICES);
  });

  test("falls back to the generic code when the player reports none", () => {
    expect(
      mapPlaybackErrorToCode({
        playSession,
        playerPlaybackError: {
          errorDescription: "",
          position: 0,
          sessionId: "",
        } as PlayerError,
      }),
    ).toBe(PlayerErrorCode.PLAYBACK_FAILED);
  });

  test("maps a failed licence request to the authorisation code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSession,
        playerPlaybackError: {
          errorCode: PlayerErrorCode.PLAYBACK_FAILED,
          errorDescription: "License request failed",
          position: 0,
          sessionId: "",
        },
      }),
    ).toBe(PlayerErrorCode.PLAYBACK_AUTHORISATION_FAILED);
  });

  test("maps unsupported runtime player errors to the format code", () => {
    const playerPlaybackError: PlayerError = {
      errorCode: PlayerErrorCode.FORMAT_NOT_SUPPORTED,
      errorDescription: "Unsupported manifest format",
      position: 0,
      sessionId: "",
    };

    expect(mapPlaybackErrorToCode({ playSession, playerPlaybackError })).toBe(
      PlayerErrorCode.FORMAT_NOT_SUPPORTED,
    );
  });

  test("maps unsupported errors by stable code when the description does not match", () => {
    const playerPlaybackError: PlayerError = {
      errorCode: PlayerErrorCode.FORMAT_NOT_SUPPORTED,
      errorDescription: "Playback could not start",
      position: 0,
      sessionId: "",
    };

    expect(mapPlaybackErrorToCode({ playSession, playerPlaybackError })).toBe(
      PlayerErrorCode.FORMAT_NOT_SUPPORTED,
    );
  });

  test("still classifies a generic player failure by its description", () => {
    const playerPlaybackError: PlayerError = {
      errorCode: PlayerErrorCode.PLAYBACK_FAILED,
      errorDescription: "Unsupported DASH stream on iOS",
      position: 0,
      sessionId: "",
    };

    expect(mapPlaybackErrorToCode({ playSession, playerPlaybackError })).toBe(
      PlayerErrorCode.FORMAT_NOT_SUPPORTED,
    );
  });

  test("maps unavailable content failures to the content-unavailable code", () => {
    expect(mapPlaybackErrorToCode({ playSessionError: { status: 404 } })).toBe(
      PlayerErrorCode.CONTENT_UNAVAILABLE,
    );
  });

  test("maps auth failures to the playback-authorisation code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: { code: "TOKEN_EXPIRED", status: 401 },
      }),
    ).toBe(PlayerErrorCode.PLAYBACK_AUTHORISATION_FAILED);
  });

  test("keeps the sign-in code the SDK sends for an expired session", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: createApiError({
          code: "AUTH_006",
          status: 401,
          statusText: "Unauthorized",
        }),
      }),
    ).toBe("AUTH_006");
  });

  test("maps a Synamedia geo restriction to the region-restricted code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: createRegionRestrictedError(),
      }),
    ).toBe(PlayerErrorCode.REGION_RESTRICTED);
  });

  test("prefers the region restriction over the auth code for a geo 403", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: createRegionRestrictedError(),
      }),
    ).toBe(PlayerErrorCode.REGION_RESTRICTED);
  });

  test("still maps a non-geo 403 to the playback-authorisation code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: createApiError({
          code: "INVALID_TOKEN",
          status: 403,
          statusText: "Forbidden",
        }),
      }),
    ).toBe(PlayerErrorCode.PLAYBACK_AUTHORISATION_FAILED);
  });

  test("does not infer a region restriction from an unrecognised provider code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: createApiError({
          code: "UNRECOGNISED_GEOLOCATION_FAILURE",
          status: 403,
          statusText: "Forbidden",
        }),
      }),
    ).toBe(PlayerErrorCode.PLAYBACK_AUTHORISATION_FAILED);
  });

  test("detects a region restriction carried only by the error code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: Object.assign(new Error("Request failed"), {
          code: "GEO_LOCATION_ERROR",
          status: 403,
        }),
      }),
    ).toBe(PlayerErrorCode.REGION_RESTRICTED);
  });

  test("detects a region restriction carried only by the description", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: Object.assign(new Error("Request failed"), {
          description:
            "EStreamingGeoLocationError: 602-UNSUPPORTED_CPE_LOCATION",
          status: 403,
        }),
      }),
    ).toBe(PlayerErrorCode.REGION_RESTRICTED);
  });

  test("does not treat an unrelated 403 mentioning location as a region block", () => {
    expect(
      mapPlaybackErrorToCode({
        playSessionError: Object.assign(
          new Error("Location header missing from the response"),
          { status: 403 },
        ),
      }),
    ).toBe(PlayerErrorCode.PLAYBACK_AUTHORISATION_FAILED);
  });

  test("honours a region restriction reported by the player itself", () => {
    expect(
      mapPlaybackErrorToCode({
        playSession,
        playerPlaybackError: {
          errorCode: PlayerErrorCode.REGION_RESTRICTED,
          errorDescription: "Blocked",
          position: 0,
          sessionId: "",
        },
      }),
    ).toBe(PlayerErrorCode.REGION_RESTRICTED);
  });

  test("maps unknown player errors to the generic playback code", () => {
    expect(
      mapPlaybackErrorToCode({
        playSession,
        playerPlaybackError: {
          errorCode: PlayerErrorCode.PLAYBACK_FAILED,
          errorDescription: "Decoder failed",
          position: 0,
          sessionId: "",
        },
      }),
    ).toBe(PlayerErrorCode.PLAYBACK_FAILED);
  });

  test("falls back to the generic playback code when nothing matches", () => {
    expect(mapPlaybackErrorToCode({})).toBe(PlayerErrorCode.PLAYBACK_FAILED);
  });

  test("prioritises the device code over other causes", () => {
    setPlatform("ios");

    expect(
      mapPlaybackErrorToCode({
        playSession: { ...playSession, drmType: "wvDrm" },
        playSessionError: { status: 401 },
      }),
    ).toBe(PlayerErrorCode.DEVICE_NOT_SUPPORTED);
  });
});
