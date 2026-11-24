import { QueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

let mockIsDevice = true;

jest.mock("expo-device", () => ({
  get isDevice() {
    return mockIsDevice;
  },
}));

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  ClientMetadata: { getFairplayServerCertificateUrl: jest.fn() },
  ContentCatalogue: { getAsset: jest.fn() },
  PlaySession: { createPlaySession: jest.fn() },
}));

jest.mock("@/infra/error", () => ({ reportError: jest.fn() }));

import { SynamediaGoApiError } from "@bfbs/common-sdk";
import {
  type PlaybackTarget,
  preparePlayback as prepareAuthorizedPlayback,
} from "@/features/video-player/prepare-playback";

const mockCreatePlaySession = jest.requireMock("@bfbs/common-sdk").PlaySession
  .createPlaySession as jest.Mock;
const mockGetFairplayCertificateUrl = jest.requireMock("@bfbs/common-sdk")
  .ClientMetadata.getFairplayServerCertificateUrl as jest.Mock;
const mockReportError = jest.requireMock("@/infra/error")
  .reportError as jest.Mock;
const mockGetAsset = jest.requireMock("@bfbs/common-sdk").ContentCatalogue
  .getAsset as jest.Mock;
const mockAuthorizePlayback = jest.fn(async () => true);

function preparePlayback(queryClient: QueryClient, target: PlaybackTarget) {
  return prepareAuthorizedPlayback(queryClient, target, mockAuthorizePlayback);
}

const mockClose = jest.fn(() => Promise.resolve());

const originalPlatformOs = Platform.OS;
const queryClients = new Set<QueryClient>();

function setPlatform(os: "android" | "ios") {
  Object.defineProperty(Platform, "OS", { configurable: true, value: os });
}

function createQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  queryClients.add(queryClient);

  return queryClient;
}

describe("preparePlayback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthorizePlayback.mockResolvedValue(true);
    mockIsDevice = true;
    setPlatform("ios");
    mockGetFairplayCertificateUrl.mockResolvedValue(
      "https://example.com/fairplay.cer",
    );
    mockGetAsset.mockResolvedValue({ id: "vod-1", title: "Frasier" });
    mockCreatePlaySession.mockResolvedValue({
      id: "session-1",
      manifestUrl: "https://example.com/vod.m3u8",
    });
  });

  afterEach(() => {
    for (const queryClient of queryClients) {
      queryClient.clear();
    }
    queryClients.clear();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOs,
    });
  });

  test("clears a VOD title that resolves into a playable source", async () => {
    const failure = await preparePlayback(createQueryClient(), {
      assetId: "vod-1",
      kind: "vod",
    });

    expect(failure).toBeNull();
    expect(mockGetAsset).toHaveBeenCalledTimes(1);
    expect(mockCreatePlaySession).toHaveBeenCalledWith({ assetId: "vod-1" });
  });

  test("creates one play session that the player then reuses", async () => {
    const queryClient = createQueryClient();

    await preparePlayback(queryClient, { channelId: "bfbs-1", kind: "live" });

    expect(
      queryClient.getQueryData(["playSession", { channelId: "bfbs-1" }]),
    ).toEqual({ id: "session-1", manifestUrl: "https://example.com/vod.m3u8" });
    expect(mockCreatePlaySession).toHaveBeenCalledTimes(1);
  });

  test("reports the region code when Synamedia geo-blocks the title", async () => {
    mockCreatePlaySession.mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        code: "GEO_LOCATION_ERROR",
        status: 403,
      }),
    );

    const failure = await preparePlayback(createQueryClient(), {
      channelId: "bfbs-1",
      kind: "live",
    });

    expect(failure).toBe("PLAY_003");
  });

  test("reports the server code when the request never reaches Synamedia", async () => {
    mockCreatePlaySession.mockRejectedValue(
      new TypeError("Network request failed"),
    );

    const failure = await preparePlayback(createQueryClient(), {
      channelId: "bfbs-1",
      kind: "live",
    });

    expect(failure).toBe("NET_003");
  });

  test("reports the timed-out code when Synamedia does not answer in time", async () => {
    mockCreatePlaySession.mockRejectedValue(
      Object.assign(new Error("Request timed out: POST /playSession"), {
        name: "TimeoutError",
      }),
    );

    const failure = await preparePlayback(createQueryClient(), {
      channelId: "bfbs-1",
      kind: "live",
    });

    expect(failure).toBe("NET_004");
  });

  test("leaves terminal session expiry for the app auth gate", async () => {
    const error = new SynamediaGoApiError({
      code: "AUTH_006",
      status: 401,
      statusText: "Unauthorized",
    });
    mockCreatePlaySession.mockRejectedValue(error);

    await expect(
      preparePlayback(createQueryClient(), {
        channelId: "bfbs-1",
        kind: "live",
      }),
    ).rejects.toBe(error);

    expect(mockReportError).not.toHaveBeenCalled();
  });

  test("leaves a removed device for the AUTH_020 flow without a new play session", async () => {
    const error = new SynamediaGoApiError({
      code: "AUTH_020",
      reason: "device_not_registered",
      status: 403,
      statusText: "Forbidden",
    });
    mockCreatePlaySession.mockRejectedValue(error);

    await expect(
      preparePlayback(createQueryClient(), {
        channelId: "bfbs-1",
        kind: "live",
      }),
    ).rejects.toBe(error);

    expect(mockCreatePlaySession).toHaveBeenCalledTimes(1);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  test("reports the device code for Widevine on iOS", async () => {
    mockCreatePlaySession.mockResolvedValue({
      close: mockClose,
      drmType: "wvDrm",
      id: "session-1",
      manifestUrl: "https://example.com/live.m3u8",
    });

    const failure = await preparePlayback(createQueryClient(), {
      channelId: "bfbs-1",
      kind: "live",
    });

    expect(failure).toBe("PLAY_004");
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test("accepts Widevine on Android", async () => {
    setPlatform("android");
    mockCreatePlaySession.mockResolvedValue({
      drmType: "wvDrm",
      id: "session-1",
      manifestUrl: "https://example.com/live.m3u8",
    });

    const failure = await preparePlayback(createQueryClient(), {
      channelId: "bfbs-1",
      kind: "live",
    });

    expect(failure).toBeNull();
  });

  test("reports the device code for FairPlay on an iOS simulator", async () => {
    mockIsDevice = false;
    mockCreatePlaySession.mockResolvedValue({
      close: mockClose,
      drmProperties: {
        blob: "token",
        laUrl: "https://example.com/fairplay/license",
      },
      drmType: "fpDrm",
      id: "session-1",
      manifestUrl: "https://example.com/vod.m3u8",
    });

    const failure = await preparePlayback(createQueryClient(), {
      assetId: "vod-1",
      kind: "vod",
    });

    expect(failure).toBe("PLAY_004");
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test("accepts FairPlay on a physical iOS device", async () => {
    mockCreatePlaySession.mockResolvedValue({
      drmProperties: {
        blob: "token",
        laUrl: "https://example.com/fairplay/license",
      },
      drmType: "fpDrm",
      id: "session-1",
      manifestUrl: "https://example.com/vod.m3u8",
    });

    const failure = await preparePlayback(createQueryClient(), {
      assetId: "vod-1",
      kind: "vod",
    });

    expect(failure).toBeNull();
  });

  test("reports the format code for a DASH stream on iOS", async () => {
    mockCreatePlaySession.mockResolvedValue({
      close: mockClose,
      id: "session-1",
      manifestUrl: "https://example.com/live.mpd",
    });

    const failure = await preparePlayback(createQueryClient(), {
      channelId: "bfbs-1",
      kind: "live",
    });

    expect(failure).toBe("PLAY_006");
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test("reports the failure with the code the user is shown", async () => {
    mockCreatePlaySession.mockRejectedValue(
      Object.assign(new Error("Request failed"), { status: 404 }),
    );

    await preparePlayback(createQueryClient(), {
      channelId: "bfbs-1",
      kind: "live",
    });

    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), {
      tags: { errorCode: "PLAY_002" },
    });
  });

  test("leaves the mocked live channels alone", async () => {
    const failure = await preparePlayback(createQueryClient(), {
      channelId: "bfbs-live-mock",
      kind: "live",
    });

    expect(failure).toBeNull();
    expect(mockCreatePlaySession).not.toHaveBeenCalled();
  });
});
