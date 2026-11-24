import { act, renderHook } from "@testing-library/react-native";

const mockAuthorizePlayback = jest.fn(async () => true);

jest.mock("@/features/auth/auth-session-context", () => ({
  usePlaybackAuthorization: () => mockAuthorizePlayback,
}));

const mockPush = jest.fn();
const mockRequestSignIn = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (href: unknown) => mockPush(href) },
}));

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  ClientMetadata: { getFairplayServerCertificateUrl: jest.fn() },
  ContentCatalogue: { getAsset: jest.fn() },
  PlaySession: { createPlaySession: jest.fn() },
}));

jest.mock("@/features/auth/sign-in-request-store", () => ({
  requestSignIn: () => mockRequestSignIn(),
}));

import { SynamediaGoApiError } from "@bfbs/common-sdk";
import {
  clearDeviceRemoved,
  useIsDeviceRemoved,
} from "@/features/auth/device-removed-store";
import { usePlaybackLauncher } from "@/features/video-player";
import { dismissErrorModal, errorModalStore } from "@/infra/error";
import { appQueryClient } from "@/infra/query/app-query-client";

const mockCreatePlaySession = jest.requireMock("@bfbs/common-sdk").PlaySession
  .createPlaySession as jest.Mock;
const mockGetAsset = jest.requireMock("@bfbs/common-sdk").ContentCatalogue
  .getAsset as jest.Mock;

describe("usePlaybackLauncher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthorizePlayback.mockResolvedValue(true);
    dismissErrorModal();
    clearDeviceRemoved();
    appQueryClient.clear();
    mockGetAsset.mockResolvedValue({ id: "vod-1", title: "Frasier" });
    mockCreatePlaySession.mockResolvedValue({
      id: "session-1",
      close: jest.fn(async () => {}),
      manifestUrl: "https://example.com/vod.m3u8",
    });
  });

  afterEach(() => {
    appQueryClient.clear();
  });

  test("opens the player once the source is known to work", async () => {
    const { result } = renderHook(() => usePlaybackLauncher());

    await result.current.openVodAsset({ id: "vod-1", title: "Frasier" });

    expect(mockPush).toHaveBeenCalledWith({
      params: { id: "vod-1", title: "Frasier" },
      pathname: "/player/vod/[id]",
    });
    expect(errorModalStore.getState().code).toBeNull();
  });

  test("repeats the same call when the dialog asks to retry", async () => {
    mockCreatePlaySession
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValue({
        id: "session-1",
        close: jest.fn(async () => {}),
        manifestUrl: "https://example.com/live.m3u8",
      });

    const { result } = renderHook(() => usePlaybackLauncher());

    await result.current.openLiveChannel("bfbs-1");

    expect(errorModalStore.getState().code).toBe("NET_003");

    await act(async () => {
      errorModalStore.getState().onRetry?.();
    });

    expect(mockPush).toHaveBeenCalledWith({
      params: { channelId: "bfbs-1" },
      pathname: "/player/live/[channelId]",
    });
  });

  test("raises the dialog instead of opening a player that would fail", async () => {
    mockCreatePlaySession.mockRejectedValue(
      Object.assign(new Error("Request failed"), { status: 404 }),
    );

    const { result } = renderHook(() => usePlaybackLauncher());

    await result.current.openLiveChannel("bfbs-1");

    expect(mockPush).not.toHaveBeenCalled();
    expect(errorModalStore.getState().code).toBe("PLAY_002");
  });

  test("returns an expired SDK session to sign-in without a playback dialog", async () => {
    mockCreatePlaySession.mockRejectedValue(
      new SynamediaGoApiError({
        code: "AUTH_006",
        status: 401,
        statusText: "Unauthorized",
      }),
    );

    const { result } = renderHook(() => usePlaybackLauncher());

    await result.current.openLiveChannel("bfbs-1");

    expect(mockRequestSignIn).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(errorModalStore.getState().code).toBeNull();
  });

  test("hands a removed device to the AUTH_020 flow without a player, dialog or retry", async () => {
    mockCreatePlaySession.mockRejectedValue(
      new SynamediaGoApiError({
        code: "AUTH_020",
        reason: "device_not_registered",
        status: 403,
        statusText: "Forbidden",
      }),
    );
    const isDeviceRemoved = renderHook(() => useIsDeviceRemoved());
    const { result } = renderHook(() => usePlaybackLauncher());

    await act(async () => {
      await result.current.openLiveChannel("bfbs-1");
    });

    expect(isDeviceRemoved.result.current).toBe(true);
    expect(mockCreatePlaySession).toHaveBeenCalledTimes(1);
    expect(mockRequestSignIn).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(errorModalStore.getState().code).toBeNull();
  });

  test("still shows AUTH_020 when a cached play session is refetched", async () => {
    const isDeviceRemoved = renderHook(() => useIsDeviceRemoved());
    const { result } = renderHook(() => usePlaybackLauncher());
    await result.current.openLiveChannel("bfbs-1");
    mockCreatePlaySession.mockRejectedValue(
      new SynamediaGoApiError({
        code: "AUTH_020",
        reason: "device_not_registered",
        status: 403,
        statusText: "Forbidden",
      }),
    );

    await act(async () => {
      await result.current.openLiveChannel("bfbs-1");
    });

    expect(isDeviceRemoved.result.current).toBe(true);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(errorModalStore.getState().code).toBeNull();
  });

  test("ignores a second press while the first is still preparing", async () => {
    let resolveSession: (session: unknown) => void = () => {};

    mockCreatePlaySession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );

    const { result } = renderHook(() => usePlaybackLauncher());

    let firstPress: Promise<void> = Promise.resolve();

    await act(async () => {
      firstPress = result.current.openLiveChannel("bfbs-1");
    });

    await act(async () => {
      await result.current.openLiveChannel("bfbs-1");
    });

    expect(mockCreatePlaySession).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSession({
        id: "session-1",
        close: jest.fn(async () => {}),
        manifestUrl: "https://example.com/live.m3u8",
      });
      await firstPress;
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  test("hands over to the channel pressed last", async () => {
    const sessions: ((session: unknown) => void)[] = [];

    mockCreatePlaySession.mockImplementation(
      () =>
        new Promise((resolve) => {
          sessions.push(resolve);
        }),
    );

    const { result } = renderHook(() => usePlaybackLauncher());

    let firstPress: Promise<void> = Promise.resolve();
    let secondPress: Promise<void> = Promise.resolve();

    await act(async () => {
      firstPress = result.current.openLiveChannel("bfbs-1");
    });

    await act(async () => {
      secondPress = result.current.openLiveChannel("bfbs-2");
    });

    expect(mockCreatePlaySession).toHaveBeenCalledTimes(2);

    await act(async () => {
      for (const resolveSession of sessions) {
        resolveSession({
          id: "session-1",
          close: jest.fn(async () => {}),
          manifestUrl: "https://example.com/live.m3u8",
        });
      }

      await Promise.all([firstPress, secondPress]);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      params: { channelId: "bfbs-2" },
      pathname: "/player/live/[channelId]",
    });
  });

  test("keeps a replaced channel's failure to itself", async () => {
    const sessions: ((session: unknown) => void)[] = [];
    const failures: ((reason: unknown) => void)[] = [];

    mockCreatePlaySession.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          sessions.push(resolve);
          failures.push(reject);
        }),
    );

    const { result } = renderHook(() => usePlaybackLauncher());

    let firstPress: Promise<void> = Promise.resolve();
    let secondPress: Promise<void> = Promise.resolve();

    await act(async () => {
      firstPress = result.current.openLiveChannel("bfbs-1");
    });

    await act(async () => {
      secondPress = result.current.openLiveChannel("bfbs-2");
    });

    await act(async () => {
      failures[0]?.(new Error("the abandoned channel failed"));
      sessions[1]?.({
        id: "session-1",
        close: jest.fn(async () => {}),
        manifestUrl: "https://example.com/live.m3u8",
      });

      await Promise.all([firstPress, secondPress]);
    });

    expect(errorModalStore.getState().code).toBeNull();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
