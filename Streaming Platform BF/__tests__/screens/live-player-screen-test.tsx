jest.mock("@/features/auth/auth-session-context", () => ({
  ...jest.requireActual("@/features/auth/auth-session-context"),
  usePlaybackAuthorization: () => async () => true,
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { BackHandler, Platform } from "react-native";

const mockGetAllChannels = jest.fn();
const mockGetProgrammeGuide = jest.fn();
const mockGetChannelNowAndNextSchedule = jest.fn();
const mockCreatePlaySession = jest.fn();
const mockProduceEvent = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterSetParams = jest.fn();
let mockChannelId = "bfbs-channel-1";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ channelId: mockChannelId }),
  useRouter: () => ({
    back: mockRouterBack,
    setParams: (params: { channelId: string }) => {
      mockChannelId = params.channelId;
      mockRouterSetParams(params);
    },
  }),
}));

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: Record<string, unknown>) => <View {...props} /> };
});

jest.mock("@gorhom/portal", () => ({
  Portal: ({ children }: { children: ReactNode }) => children,
  PortalProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock("react-native-safe-area-context", () => {
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
    initialWindowMetrics: {
      frame: { height: 0, width: 0, x: 0, y: 0 },
      insets,
    },
    useSafeAreaInsets: () => insets,
  };
});

jest.mock("@bfbs/common-sdk", () => ({
  ActionScreenEventType: {
    DISMISSED: "DISMISSED",
    LOADED: "LOADED",
  },
  ContentCatalogue: {
    getAllChannels: mockGetAllChannels,
    getChannelNowAndNextSchedule: mockGetChannelNowAndNextSchedule,
    getProgrammeGuide: mockGetProgrammeGuide,
  },
  EventBus: { produce: mockProduceEvent },
  EventType: { ACTION_SCREEN_CHANGE: "ACTION_SCREEN_CHANGE" },
  PlaybackPlayerState: {
    BUFFERING: "buffering",
    ENDED: "ended",
    ERROR: "error",
    IDLE: "idle",
    LOADING: "loading",
    PAUSED: "paused",
    PLAYING: "playing",
    READY: "ready",
  },
  PlaybackSourceType: {
    DASH: "dash",
    HLS: "hls",
    PROGRESSIVE: "progressive",
  },
  PlayerErrorCode: {
    CONTENT_UNAVAILABLE: "PLAY_002",
    DEVICE_NOT_SUPPORTED: "PLAY_004",
    FORMAT_NOT_SUPPORTED: "PLAY_006",
    NETWORK_OFFLINE: "NET_001",
    PLAYBACK_FAILED: "PLAY_001",
    REGION_RESTRICTED: "PLAY_003",
    SERVER_UNAVAILABLE: "NET_003",
    TOO_MANY_DEVICES: "PLAY_008",
    UNEXPECTED_ERROR: "SYS_002",
  },
  PlaySession: {
    createPlaySession: mockCreatePlaySession,
  },
  isDeviceNotRegisteredError: () => false,
}));

jest.mock("expo-device", () => ({
  DeviceType: {
    PHONE: "phone",
    TABLET: "tablet",
  },
  deviceType: "phone",
}));

jest.mock("expo-screen-orientation", () => ({
  OrientationLock: {
    LANDSCAPE: "landscape",
    PORTRAIT_UP: "portrait-up",
  },
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
}));

jest
  .spyOn(require("react-native"), "useWindowDimensions")
  .mockReturnValue({ fontScale: 2, height: 844, scale: 3, width: 390 });

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
  setStatusBarHidden: jest.fn(),
}));

jest.mock("expo-navigation-bar", () => ({
  setBehaviorAsync: jest.fn().mockResolvedValue(undefined),
  setVisibilityAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/infra/error", () => ({
  ...jest.requireActual("@/infra/error"),
  reportError: jest.fn(),
}));

const ScreenOrientation = jest.requireMock("expo-screen-orientation");
const LivePlayerScreen = require("@/app/player/live/[channelId]").default;

const ORIGINAL_USE_MOCKS = process.env.EXPO_PUBLIC_LIVE_PLAYER_USE_MOCKS;
const originalPlatformOs = Platform.OS;
const queryClients = new Set<QueryClient>();

function renderLivePlayerScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  });
  queryClients.add(queryClient);

  return render(
    <QueryClientProvider client={queryClient}>
      <LivePlayerScreen />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  for (const queryClient of queryClients) {
    queryClient.clear();
  }
  queryClients.clear();
});

describe("<LivePlayerScreen />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChannelId = "bfbs-channel-1";
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-08T09:15:00.000Z"));
    process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_LICENSE_KEY = "license-key";
    process.env.EXPO_PUBLIC_LIVE_PLAYER_USE_MOCKS = "false";
    mockGetAllChannels.mockResolvedValue([
      {
        id: "bfbs-channel-1",
        isPlayable: true,
        logicalChannelNumber: 1,
        name: "WDR",
      },
    ]);
    mockGetProgrammeGuide.mockResolvedValue({
      channels: [
        {
          channelId: "bfbs-channel-1",
          programmes: [
            {
              expirationDateTime: "2026-06-08T10:00:00.000Z",
              id: "programme-1",
              startDateTime: "2026-06-08T09:00:00.000Z",
              title: "Hidden Assets",
            },
          ],
        },
      ],
    });
    mockGetChannelNowAndNextSchedule.mockResolvedValue({
      currentProgramme: {
        expirationDateTime: "2026-06-08T10:00:00.000Z",
        id: "programme-1",
        startDateTime: "2026-06-08T09:00:00.000Z",
        title: "Hidden Assets",
      },
    });
    mockCreatePlaySession.mockResolvedValue({
      close: jest.fn(() => Promise.resolve()),
      id: "session-1",
      manifestUrl: "https://example.com/live.m3u8",
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOs,
    });

    if (ORIGINAL_USE_MOCKS === undefined) {
      delete process.env.EXPO_PUBLIC_LIVE_PLAYER_USE_MOCKS;
    } else {
      process.env.EXPO_PUBLIC_LIVE_PLAYER_USE_MOCKS = ORIGINAL_USE_MOCKS;
    }
  });

  test("starts the selected channel and locks the player to landscape", async () => {
    renderLivePlayerScreen();

    await waitFor(() => {
      expect(mockCreatePlaySession).toHaveBeenCalledWith({
        channelId: "bfbs-channel-1",
      });
    });

    await waitFor(() => {
      expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith("landscape");
    });
  });

  test("shows the error card when the channel cannot start", async () => {
    mockCreatePlaySession.mockReset();
    mockCreatePlaySession.mockRejectedValue(
      new Error("Failed to create session"),
    );

    const { getByTestId, getByText } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("error-modal");
    });

    getByText("Unable to Play");
  });

  test("creates a fresh session when retrying a terminal playback error", async () => {
    const closeFirstSession = jest.fn(() => Promise.resolve());
    mockCreatePlaySession
      .mockResolvedValueOnce({
        close: closeFirstSession,
        id: "session-1",
        manifestUrl: "https://example.com/live.m3u8",
        startKeepAlive: jest.fn(),
        stopKeepAlive: jest.fn(),
      })
      .mockResolvedValueOnce({
        close: jest.fn(() => Promise.resolve()),
        id: "session-2",
        manifestUrl: "https://example.com/live.m3u8",
        startKeepAlive: jest.fn(),
        stopKeepAlive: jest.fn(),
      });

    const { getByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      expect(mockCreatePlaySession).toHaveBeenCalledTimes(1);
      getByTestId("player-view");
    });

    fireEvent(getByTestId("player-view"), "onError", {
      code: "1001",
      message: "RAW_NATIVE_PLAYER_ERROR",
    });

    await waitFor(() => {
      expect(closeFirstSession).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByTestId("error-action-retry"));

    await waitFor(() => {
      expect(mockCreatePlaySession).toHaveBeenCalledTimes(2);
    });
  });

  test("shows the region-restricted card when Synamedia geo-blocks the channel", async () => {
    mockCreatePlaySession.mockReset();
    mockCreatePlaySession.mockRejectedValue(
      Object.assign(
        new Error(
          "Synamedia Go request failed with 403 : GEO_LOCATION_ERROR - EStreamingGeoLocationError: 602-UNSUPPORTED_CPE_LOCATION",
        ),
        {
          code: "GEO_LOCATION_ERROR",
          description:
            "EStreamingGeoLocationError: 602-UNSUPPORTED_CPE_LOCATION",
          status: 403,
        },
      ),
    );

    const { getByText } = renderLivePlayerScreen();

    await waitFor(() => {
      getByText("Not Available in Your Region");
    });
  });

  test("shows the playback card when iOS receives a DASH manifest", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios",
    });
    mockCreatePlaySession.mockResolvedValue({
      close: jest.fn(() => Promise.resolve()),
      id: "session-1",
      manifestUrl: "https://example.com/live.mpd",
    });

    const { getByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("error-modal");
    });
  });

  test("navigates back and restores portrait when the error card is closed", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios",
    });
    mockCreatePlaySession.mockResolvedValue({
      close: jest.fn(() => Promise.resolve()),
      id: "session-1",
      manifestUrl: "https://example.com/live.mpd",
    });

    const { getByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("error-modal");
    });

    fireEvent.press(getByTestId("error-action-back"));

    getByTestId("live-player-closing");

    await act(async () => {});

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith("portrait-up");
  });

  test("resumes playback from the overlay and refreshes metadata at the boundary", async () => {
    jest.setSystemTime(new Date("2026-06-08T09:14:59.000Z"));
    process.env.EXPO_PUBLIC_LIVE_PLAYER_USE_MOCKS = "true";
    mockGetProgrammeGuide.mockResolvedValue({
      channels: [
        {
          channelId: "bfbs-channel-1",
          programmes: [
            {
              expirationDateTime: "2026-06-08T09:15:00.000Z",
              id: "programme-1",
              startDateTime: "2026-06-08T09:00:00.000Z",
              title: "Breakfast",
            },
          ],
        },
      ],
    });
    const { getAllByText, getByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      expect(getAllByText("Breakfast").length).toBeGreaterThan(0);
      expect(getByTestId("play-pause-action").props.accessibilityLabel).toBe(
        "Pause live playback",
      );
    });

    fireEvent.press(getByTestId("play-pause-action"));

    await waitFor(() => {
      expect(getByTestId("play-pause-action").props.accessibilityLabel).toBe(
        "Resume live playback",
      );
    });

    fireEvent.press(getByTestId("play-pause-action"));

    await waitFor(() => {
      expect(getByTestId("play-pause-action").props.accessibilityLabel).toBe(
        "Pause live playback",
      );
    });

    // The guide now carries the next programme, as it would after the boundary.
    mockGetProgrammeGuide.mockResolvedValue({
      channels: [
        {
          channelId: "bfbs-channel-1",
          programmes: [
            {
              expirationDateTime: "2026-06-08T10:00:00.000Z",
              id: "programme-2",
              startDateTime: "2026-06-08T09:15:00.000Z",
              title: "News",
            },
          ],
        },
      ],
    });

    await act(async () => {
      jest.advanceTimersByTime(2001);
    });

    await waitFor(() => {
      expect(getAllByText("News").length).toBeGreaterThan(0);
    });
  });

  test("opens the mini guide from the player controls", async () => {
    const { getByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("mini-guide-action");
    });

    fireEvent.press(getByTestId("mini-guide-action"));

    await waitFor(() => {
      getByTestId("mini-guide-backdrop");
    });
  });

  test("does not reload the player when closing with the mini guide open", async () => {
    const { getByLabelText, getByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("mini-guide-action");
    });

    fireEvent.press(getByTestId("mini-guide-action"));

    await waitFor(() => {
      getByTestId("mini-guide-backdrop");
    });

    fireEvent.press(getByLabelText("Close live player"));

    await waitFor(() => {
      expect(mockRouterBack).toHaveBeenCalled();
    });

    const screenEvents = mockProduceEvent.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === "ACTION_SCREEN_CHANGE");

    expect(
      screenEvents.filter(
        (event) =>
          event.data.eventType === "LOADED" && event.data.screenId === "player",
      ),
    ).toHaveLength(1);
  });

  test("switches channel from the mini guide via setParams", async () => {
    mockGetAllChannels.mockResolvedValue([
      {
        id: "bfbs-channel-1",
        isPlayable: true,
        logicalChannelNumber: 1,
        name: "WDR",
      },
      {
        id: "channel-2",
        isPlayable: true,
        logicalChannelNumber: 2,
        name: "ITV",
      },
    ]);

    const { getByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("mini-guide-action");
    });

    fireEvent.press(getByTestId("mini-guide-action"));

    await waitFor(() => {
      getByTestId("mini-guide-row-channel-2");
    });

    fireEvent.press(getByTestId("mini-guide-row-channel-2"));

    expect(mockRouterSetParams).toHaveBeenCalledWith({
      channelId: "channel-2",
    });
  });

  test("loads the newly selected channel after switching in place", async () => {
    mockGetAllChannels.mockResolvedValue([
      {
        id: "bfbs-channel-1",
        isPlayable: true,
        logicalChannelNumber: 1,
        name: "WDR",
      },
      {
        id: "channel-2",
        isPlayable: true,
        logicalChannelNumber: 2,
        name: "ITV",
      },
    ]);

    const { getByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("mini-guide-action");
    });

    fireEvent.press(getByTestId("mini-guide-action"));

    await waitFor(() => {
      getByTestId("mini-guide-row-channel-2");
    });

    fireEvent.press(getByTestId("mini-guide-row-channel-2"));

    await waitFor(() => {
      expect(mockCreatePlaySession).toHaveBeenCalledWith({
        channelId: "channel-2",
      });
    });
  });

  test("keeps the mini guide open when the current channel is selected", async () => {
    const { getByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("mini-guide-action");
    });

    fireEvent.press(getByTestId("mini-guide-action"));

    await waitFor(() => {
      getByTestId("mini-guide-row-bfbs-channel-1");
    });

    fireEvent.press(getByTestId("mini-guide-row-bfbs-channel-1"));

    expect(mockRouterSetParams).not.toHaveBeenCalled();
    expect(getByTestId("mini-guide-backdrop")).toBeTruthy();
  });

  test("closes the mini guide when the backdrop is tapped", async () => {
    const { getByTestId, queryByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("mini-guide-action");
    });

    fireEvent.press(getByTestId("mini-guide-action"));

    await waitFor(() => {
      getByTestId("mini-guide-backdrop");
    });

    fireEvent.press(getByTestId("mini-guide-backdrop"));

    await waitFor(() => {
      expect(queryByTestId("mini-guide-backdrop")).toBeNull();
    });
  });

  test("dismisses the mini guide after five seconds of inactivity", async () => {
    const { getByTestId, queryByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("mini-guide-action");
    });

    fireEvent.press(getByTestId("mini-guide-action"));

    await waitFor(() => {
      getByTestId("mini-guide-backdrop");
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(queryByTestId("mini-guide-backdrop")).toBeNull();
    });
  });

  test("closes the mini guide on Android hardware back", async () => {
    const backSpy = jest.spyOn(BackHandler, "addEventListener");
    const { getByTestId, queryByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("mini-guide-action");
    });

    fireEvent.press(getByTestId("mini-guide-action"));

    await waitFor(() => {
      getByTestId("mini-guide-backdrop");
    });

    const backPressHandlers = backSpy.mock.calls.filter(
      ([event]) => event === "hardwareBackPress",
    );
    const handleBackPress = backPressHandlers.at(-1)?.[1];

    let wasHandled: boolean | null | undefined;
    act(() => {
      wasHandled = handleBackPress?.();
    });

    expect(wasHandled).toBe(true);
    await waitFor(() => {
      expect(queryByTestId("mini-guide-backdrop")).toBeNull();
    });

    backSpy.mockRestore();
  });

  test("shows the content-unavailable card when the channel id matches no channel", async () => {
    mockGetAllChannels.mockResolvedValue([]);

    const { getByTestId } = renderLivePlayerScreen();

    await waitFor(() => {
      getByTestId("error-modal");
    });
  });
});
