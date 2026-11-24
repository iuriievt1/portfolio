import { Player } from "@bfbs/common-sdk/playback/bitmovin/native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as NavigationBar from "expo-navigation-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { setStatusBarHidden } from "expo-status-bar";
import { type ReactNode, useState } from "react";
import { BackHandler, Platform } from "react-native";
import { VideoPlayer } from "@/features/video-player";
import type { VideoSource } from "@/features/video-player/types";
import {
  getLivePlayerTiming,
  getLiveSyncDriftMs,
} from "@/features/video-player/utils/player-timing";
import { setDeviceOffline } from "@/infra/error/connectivity-store";

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
  ContentCatalogue: {
    getChannelAiring: jest.fn(),
  },
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
    MAINTENANCE: "SYS_003",
    NETWORK_OFFLINE: "NET_001",
    NETWORK_UNSTABLE: "NET_002",
    PLAYBACK_AUTHORISATION_FAILED: "PLAY_005",
    PLAYBACK_FAILED: "PLAY_001",
    PLAYBACK_INTERRUPTED: "PLAY_007",
    REGION_RESTRICTED: "PLAY_003",
    SERVER_UNAVAILABLE: "NET_003",
    TOO_MANY_DEVICES: "PLAY_008",
    UNEXPECTED_ERROR: "SYS_002",
  },
  PlaySession: {
    createPlaySession: jest.fn(),
    putLastPlayPosition: jest.fn(),
  },
  SynamediaGoApiError: class extends Error {
    status = 500;
  },
}));

const mockInvalidateQueries = jest.fn();
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
  };
});

const { PlaybackSourceType, PlaySession } =
  jest.requireMock("@bfbs/common-sdk");
const mockPutLastPlayPosition =
  PlaySession.putLastPlayPosition as jest.MockedFunction<
    typeof PlaySession.putLastPlayPosition
  >;
type MockedPlayerControls = {
  bitmovinPlayer: {
    timeShift: jest.Mock;
  };
  load: jest.Mock;
  pause: jest.Mock;
  play: jest.Mock;
  seek: jest.Mock;
};

function getLatestPlayerControls(): MockedPlayerControls {
  const playerInstance = jest
    .mocked(Player.createPlayer)
    .mock.results.at(-1)?.value;

  if (!playerInstance) {
    throw new Error("Player instance was not created");
  }

  return playerInstance.player as MockedPlayerControls;
}

let mockDeviceType = "phone";

jest.mock("expo-device", () => ({
  DeviceType: {
    PHONE: "phone",
    TABLET: "tablet",
  },
  get deviceType() {
    return mockDeviceType;
  },
}));

jest.mock("expo-screen-orientation", () => ({
  OrientationLock: {
    LANDSCAPE: "landscape",
    PORTRAIT_UP: "portrait-up",
  },
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
}));

const PHONE_WINDOW = { fontScale: 2, height: 844, scale: 3, width: 390 };
const TABLET_WINDOW = { fontScale: 2, height: 1280, scale: 2, width: 800 };
let mockWindowDimensions = PHONE_WINDOW;
const originalPlatformOs = Platform.OS;

jest
  .spyOn(require("react-native"), "useWindowDimensions")
  .mockImplementation(() => mockWindowDimensions);

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
  setStatusBarHidden: jest.fn(),
}));

jest.mock("expo-navigation-bar", () => ({
  setBehaviorAsync: jest.fn().mockResolvedValue(undefined),
  setVisibilityAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockProgramme = {
  endsAt: "2026-06-05T14:30:00.000Z",
  id: "hidden-assets",
  startsAt: "2026-06-05T13:00:00.000Z",
  title: "Hidden Assets",
};
const mockProgrammeStartTimestampSeconds = Math.floor(
  Date.parse(mockProgramme.startsAt) / 1000,
);
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const nextProgrammeStartTime = "2026-06-05T14:00:00.000Z";
const rolloverProgrammeStartTime = "2026-06-05T14:30:00.000Z";

function formatLocalTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: localTimeZone,
  }).format(new Date(value));
}

const mockSource: VideoSource = {
  channelId: "bfbs-live",
  channelTitle: "BFBS Live",
  programme: mockProgramme,
  sourceType: PlaybackSourceType.HLS,
  timeZone: "Europe/London",
  title: "Hidden Assets",
  url: "https://example.com/live.m3u8",
};

const playSessionMethods = {
  close: async () => {},
  startKeepAlive: () => {},
  stopKeepAlive: () => {},
};

const behindLiveMockSource: VideoSource = {
  ...mockSource,
  isMockLivePlayer: true,
  playSession: {
    ...playSessionMethods,
    captureStartTime: mockProgramme.startsAt,
    id: "mock-session",
  },
  startPositionSeconds: 30 * 60,
};

const liveMockSource: VideoSource = {
  ...mockSource,
  isMockLivePlayer: true,
  playSession: {
    ...playSessionMethods,
    captureStartTime: mockProgramme.startsAt,
    id: "mock-session",
  },
};
describe("live player timing", () => {
  test("derives programme progress and behind-live state from programme dates", () => {
    const timing = getLivePlayerTiming({
      hasLostLiveSync: true,
      nowMs: Date.parse("2026-06-05T13:45:00.000Z"),
      playheadSeconds: 60,
      programme: mockProgramme,
      source: {
        playSession: {
          ...playSessionMethods,
          captureStartTime: "2026-06-05T13:00:00.000Z",
          id: "session-1",
        },
      },
    });

    expect(timing.liveEdgeProgress).toBeCloseTo(0.5);
    expect(timing.playheadProgress).toBeCloseTo(1 / 90);
    expect(timing.isBehindLive).toBe(true);
  });

  test("treats normal live latency as still at live edge", () => {
    const timing = getLivePlayerTiming({
      nowMs: Date.parse("2026-06-05T13:45:10.000Z"),
      playheadSeconds: 45 * 60 + 1,
      programme: mockProgramme,
      source: {
        playSession: {
          ...playSessionMethods,
          id: "session-1",
        },
      },
    });

    expect(timing.measuredLiveGapMs).toBe(9000);
    expect(timing.isBehindLive).toBe(false);
  });

  test("does not infer behind-live from programme start when the stream has no reliable anchor", () => {
    const timing = getLivePlayerTiming({
      nowMs: Date.parse("2026-06-05T13:45:10.000Z"),
      playheadSeconds: 42,
      programme: mockProgramme,
      source: {
        playSession: {
          ...playSessionMethods,
          id: "session-1",
        },
      },
    });

    expect(timing.hasReliableLiveEdgeAnchor).toBe(false);
    expect(timing.measuredLiveGapMs).toBeGreaterThan(30_000);
    expect(timing.isBehindLive).toBe(false);
  });

  test("measures live drift from playhead progress instead of absolute source latency", () => {
    const anchorWallMs = Date.parse("2026-06-05T13:45:00.000Z");
    const anchorPlayheadMs = Date.parse("2026-06-05T13:44:46.000Z");

    expect(
      getLiveSyncDriftMs({
        anchorPlayheadMs,
        anchorWallMs,
        nowMs: Date.parse("2026-06-05T13:45:12.000Z"),
        playheadMs: Date.parse("2026-06-05T13:44:58.000Z"),
      }),
    ).toBe(0);

    expect(
      getLiveSyncDriftMs({
        anchorPlayheadMs,
        anchorWallMs,
        nowMs: Date.parse("2026-06-05T13:45:12.000Z"),
        playheadMs: Date.parse("2026-06-05T13:44:50.000Z"),
      }),
    ).toBe(8000);
  });

  test("marks a live stream behind once its live sync is lost", () => {
    const timing = getLivePlayerTiming({
      hasLostLiveSync: true,
      nowMs: Date.parse("2026-06-05T13:45:10.000Z"),
      playheadSeconds: 42,
      programme: mockProgramme,
      source: {
        playSession: {
          ...playSessionMethods,
          id: "session-1",
        },
      },
    });

    expect(timing.isBehindLive).toBe(true);
    expect(timing.playheadProgress).toBeLessThan(timing.liveEdgeProgress);
  });
});

describe("<VideoPlayer />", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-05T13:45:00.000Z"));
    process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_LICENSE_KEY = "license-key";
    mockPutLastPlayPosition.mockResolvedValue(undefined);
    jest.clearAllMocks();
    mockDeviceType = "phone";
    mockWindowDimensions = PHONE_WINDOW;
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOs,
    });
  });

  test("creates the player with the native Bitmovin UI disabled", () => {
    render(<VideoPlayer onClose={jest.fn()} source={mockSource} visible />);

    expect(jest.mocked(Player.createPlayer)).toHaveBeenCalledWith(
      expect.objectContaining({
        playerConfig: expect.objectContaining({
          styleConfig: { isUiEnabled: false },
        }),
      }),
    );
  });

  test("ignores a saved live resume position when loading a live stream", async () => {
    const sourceWithSavedLiveOffset: VideoSource = {
      ...mockSource,
      playSession: {
        ...playSessionMethods,
        id: "session-1",
        manifestUrl: "https://example.com/live.m3u8",
        startPlayPositionSeconds: 123,
      },
    };

    render(
      <VideoPlayer
        onClose={jest.fn()}
        source={sourceWithSavedLiveOffset}
        visible
      />,
    );

    await waitFor(() => {
      expect(getLatestPlayerControls().load).toHaveBeenCalled();
    });

    const loadRequest = getLatestPlayerControls().load.mock.calls.at(-1)?.[0];
    expect(loadRequest).toMatchObject({ sessionId: "session-1" });
    expect(loadRequest).not.toHaveProperty("startPositionSeconds");
  });

  test("shows controls on load, fades them after 3s, and reappears on tap", () => {
    const { getByTestId, getByText, queryByText } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    expect(getByText("Hidden Assets")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(queryByText("Hidden Assets")).toBeNull();

    fireEvent.press(getByTestId("player-body-toggle"));

    expect(getByText("Hidden Assets")).toBeTruthy();
  });

  test("renders the live edge indicator on programme progress", async () => {
    const { getByTestId, getByText } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    await waitFor(() => {
      getByText("Hidden Assets");
    });

    expect(getByTestId("live-edge-indicator")).toBeTruthy();

    fireEvent(getByTestId("programme-progress-label"), "layout", {
      nativeEvent: {
        layout: {
          width: 40,
        },
      },
    });
    fireEvent(getByTestId("programme-progress-track"), "layout", {
      nativeEvent: {
        layout: {
          width: 200,
        },
      },
    });

    await waitFor(() => {
      const labelStyle = getByTestId("programme-progress-label").props.style;
      const labelPositionStyle = Array.isArray(labelStyle)
        ? labelStyle.find((style) => typeof style?.left === "number")
        : labelStyle;

      expect(labelPositionStyle?.left).toBeCloseTo(80, 0);
    });
  });

  test("keeps a naturally delayed live stream at live edge while its playhead keeps advancing", async () => {
    const { getByTestId, queryByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );
    const livePositionSeconds = Date.parse("2026-06-05T13:44:46.000Z") / 1000;

    fireEvent(getByTestId("player-view"), "onStateChange", {
      positionSeconds: livePositionSeconds,
      state: "playing",
    });

    for (let second = 1; second <= 12; second += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      fireEvent(getByTestId("player-view"), "onTimeUpdate", {
        positionSeconds: livePositionSeconds + second,
      });
    }

    fireEvent.press(getByTestId("player-body-toggle"));

    expect(queryByTestId("go-to-live-action")).toBeNull();
  });

  test("renders the gradient scrim while controls are visible", () => {
    const { getByTestId, queryByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    expect(getByTestId("player-scrim")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(queryByTestId("player-scrim")).toBeNull();
  });

  test("does not show fake programme progress when source has no programme", async () => {
    const sourceWithoutProgramme: VideoSource = {
      channelId: "bfbs-live",
      channelTitle: "BFBS Live",
      sourceType: PlaybackSourceType.HLS,
      title: "BFBS Live",
      url: "https://example.com/live.m3u8",
    };
    const { getAllByText, queryByTestId } = render(
      <VideoPlayer
        onClose={jest.fn()}
        source={sourceWithoutProgramme}
        visible
      />,
    );

    await waitFor(() => {
      expect(getAllByText("BFBS Live").length).toBeGreaterThan(0);
    });

    expect(queryByTestId("programme-progress-track")).toBeNull();
  });

  test("keeps controls visible when scrubbing resets the fade timer", () => {
    const { getByTestId, getByText } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    expect(getByText("Hidden Assets")).toBeTruthy();

    const progressTrack = getByTestId("programme-progress-track");

    fireEvent(progressTrack, "layout", {
      nativeEvent: {
        layout: {
          width: 100,
        },
      },
    });

    act(() => {
      jest.advanceTimersByTime(2500);
    });

    fireEvent(progressTrack, "responderGrant", {
      nativeEvent: {
        locationX: 50,
      },
    });

    act(() => {
      jest.advanceTimersByTime(700);
    });

    expect(getByText("Hidden Assets")).toBeTruthy();
  });

  test("resets playhead timing when the source changes", async () => {
    const nextSource: VideoSource = {
      ...mockSource,
      programme: {
        endsAt: "2026-06-05T15:00:00.000Z",
        id: "next-programme",
        startsAt: nextProgrammeStartTime,
        title: "Next Programme",
      },
      title: "Next Programme",
    };
    const { getByTestId, getByText, rerender } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    await waitFor(() => {
      getByText("Hidden Assets");
    });

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 60,
    });

    rerender(<VideoPlayer onClose={jest.fn()} source={nextSource} visible />);

    await waitFor(() => {
      getByText("Next Programme");
      getByText(formatLocalTime(nextProgrammeStartTime));
    });
  });

  test("refreshes programme metadata when the live programme boundary passes", async () => {
    const nextSource: VideoSource = {
      ...mockSource,
      programme: {
        endsAt: "2026-06-05T16:30:00.000Z",
        id: "next-programme",
        startsAt: rolloverProgrammeStartTime,
        title: "Forces News",
      },
      title: "Forces News",
    };

    function BoundaryRefreshHarness() {
      const [source, setSource] = useState(mockSource);

      return (
        <VideoPlayer
          onClose={jest.fn()}
          onProgrammeBoundary={() => {
            setSource(nextSource);
          }}
          source={source}
          visible
        />
      );
    }

    const { getByText } = render(<BoundaryRefreshHarness />);

    await waitFor(() => {
      getByText("Hidden Assets");
    });

    act(() => {
      jest.advanceTimersByTime(45 * 60 * 1000 + 1500);
    });

    await waitFor(() => {
      getByText("Forces News");
      getByText(formatLocalTime(rolloverProgrammeStartTime));
    });
  });

  test("pauses real playback from the play/pause control", async () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );
    const playerControls = getLatestPlayerControls();

    fireEvent(getByTestId("player-view"), "onStateChange", {
      state: "playing",
    });
    fireEvent.press(getByTestId("play-pause-action"));

    expect(playerControls.pause).toHaveBeenCalledTimes(1);
  });

  test("resumes real playback from the play/pause control", async () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );
    const playerControls = getLatestPlayerControls();

    fireEvent(getByTestId("player-view"), "onStateChange", {
      state: "paused",
    });
    fireEvent.press(getByTestId("play-pause-action"));

    expect(playerControls.play).toHaveBeenCalledTimes(1);
  });

  test("restarts real live playback from the current programme start", () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );
    const playerControls = getLatestPlayerControls();

    fireEvent.press(getByTestId("restart-action"));

    expect(playerControls.bitmovinPlayer.timeShift).toHaveBeenCalledWith(
      mockProgrammeStartTimestampSeconds,
    );
  });

  test("rewinds real live playback from the progress bar", () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );
    const playerControls = getLatestPlayerControls();

    fireEvent(getByTestId("programme-progress-track"), "layout", {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(getByTestId("programme-progress-track"), "responderGrant", {
      nativeEvent: { locationX: 40 },
    });
    fireEvent(getByTestId("programme-progress-track"), "responderRelease", {
      nativeEvent: { locationX: 40 },
    });

    expect(playerControls.bitmovinPlayer.timeShift).toHaveBeenCalledWith(
      mockProgrammeStartTimestampSeconds + 18 * 60,
    );
  });

  test("keeps the live-edge label during the grace period for rewind-capable live streams", () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    fireEvent(getByTestId("player-view"), "onStateChange", {
      positionSeconds: mockProgrammeStartTimestampSeconds + 18 * 60,
      state: "playing",
    });

    expect(getByTestId("programme-progress-label").props.children).toBe(
      formatLocalTime("2026-06-05T13:45:00.000Z"),
    );
  });

  test("does not show go to live for normal live latency", async () => {
    const { getByTestId, queryByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: mockProgrammeStartTimestampSeconds + 44 * 60 + 56,
    });

    await waitFor(() => {
      expect(queryByTestId("go-to-live-action")).toBeNull();
    });
  });

  test("freezes the real live progress at the rewound position when paused", () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    act(() => {
      jest.advanceTimersByTime(1);
    });

    fireEvent(getByTestId("player-view"), "onStateChange", {
      positionSeconds: mockProgrammeStartTimestampSeconds + 18 * 60,
      state: "paused",
    });

    act(() => {
      jest.advanceTimersByTime(11_000);
    });

    fireEvent.press(getByTestId("player-body-toggle"));

    expect(getByTestId("programme-progress-label").props.children).toBe(
      formatLocalTime("2026-06-05T13:18:00.000Z"),
    );

    act(() => {
      jest.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(getByTestId("programme-progress-label").props.children).toBe(
      formatLocalTime("2026-06-05T13:18:00.000Z"),
    );
  });

  test("jumps real live playback to the live edge", async () => {
    const behindLiveSource: VideoSource = {
      ...mockSource,
      startPositionSeconds: 30 * 60,
    };
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={behindLiveSource} visible />,
    );
    const playerControls = getLatestPlayerControls();

    act(() => {
      jest.advanceTimersByTime(11_000);
    });

    fireEvent.press(getByTestId("player-body-toggle"));
    fireEvent.press(getByTestId("go-to-live-action"));

    expect(playerControls.bitmovinPlayer.timeShift).toHaveBeenCalledWith(0);
  });

  test("does not persist live play position when the player is hidden", async () => {
    const sourceWithPlaySession: VideoSource = {
      ...mockSource,
      playSession: {
        ...playSessionMethods,
        id: "session-1",
        manifestUrl: "https://example.com/live.m3u8",
      },
    };
    const { getByTestId, rerender } = render(
      <VideoPlayer
        onClose={jest.fn()}
        source={sourceWithPlaySession}
        visible
      />,
    );

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 123,
    });

    rerender(
      <VideoPlayer
        onClose={jest.fn()}
        source={sourceWithPlaySession}
        visible={false}
      />,
    );

    await act(async () => {});

    expect(mockPutLastPlayPosition).not.toHaveBeenCalled();
  });

  test("persists play position for non-live sessions when the player is hidden", async () => {
    const sourceWithPlaySession: VideoSource = {
      playSession: {
        ...playSessionMethods,
        assetId: "asset-2",
        id: "session-2",
        manifestUrl: "https://example.com/asset.m3u8",
      },
      sourceType: PlaybackSourceType.HLS,
      title: "Hidden Assets On Demand",
      url: "https://example.com/asset.m3u8",
    };
    const { getByTestId, rerender } = render(
      <VideoPlayer
        onClose={jest.fn()}
        source={sourceWithPlaySession}
        visible
      />,
    );

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 123,
    });

    rerender(
      <VideoPlayer
        onClose={jest.fn()}
        source={sourceWithPlaySession}
        visible={false}
      />,
    );

    await waitFor(() => {
      expect(mockPutLastPlayPosition).toHaveBeenCalledWith({
        assetId: "asset-2",
        positionSeconds: 123,
      });
    });

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["asset"],
      });
    });
  });

  test("does not persist play position when the play session has no asset id", async () => {
    const sourceWithoutAssetId: VideoSource = {
      playSession: {
        ...playSessionMethods,
        id: "session-3",
        manifestUrl: "https://example.com/asset.m3u8",
      },
      sourceType: PlaybackSourceType.HLS,
      title: "Hidden Assets On Demand",
      url: "https://example.com/asset.m3u8",
    };
    const { getByTestId, rerender } = render(
      <VideoPlayer onClose={jest.fn()} source={sourceWithoutAssetId} visible />,
    );

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 123,
    });

    rerender(
      <VideoPlayer
        onClose={jest.fn()}
        source={sourceWithoutAssetId}
        visible={false}
      />,
    );

    await act(async () => {});

    expect(mockPutLastPlayPosition).not.toHaveBeenCalled();
  });

  test("pauses playback when the source is removed while still visible", async () => {
    const { rerender } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    const playerControls = getLatestPlayerControls();

    rerender(<VideoPlayer onClose={jest.fn()} source={undefined} visible />);

    await waitFor(() => {
      expect(playerControls.pause).toHaveBeenCalled();
    });
  });

  test("opens the mini guide as an overlay without closing the player", async () => {
    const onClose = jest.fn();
    const onOpenMiniGuide = jest.fn();
    const { getAllByText, getByTestId, getByText } = render(
      <VideoPlayer
        onClose={onClose}
        onOpenMiniGuide={onOpenMiniGuide}
        source={mockSource}
        visible
      />,
    );

    await waitFor(() => {
      getByText("Mini Guide");
    });

    fireEvent.press(getByTestId("mini-guide-action"));

    expect(getAllByText("BFBS Live").length).toBeGreaterThan(0);
    expect(onOpenMiniGuide).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("toggles the mini guide closed on a second press without re-firing onOpenMiniGuide", async () => {
    const onOpenMiniGuide = jest.fn();
    const { getByTestId, getByText, queryAllByText } = render(
      <VideoPlayer
        onClose={jest.fn()}
        onOpenMiniGuide={onOpenMiniGuide}
        source={mockSource}
        visible
      />,
    );

    await waitFor(() => {
      getByText("Mini Guide");
    });

    fireEvent.press(getByTestId("mini-guide-action"));
    expect(queryAllByText("BFBS Live").length).toBeGreaterThan(0);
    expect(onOpenMiniGuide).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId("mini-guide-action"));
    expect(queryAllByText("BFBS Live")).toHaveLength(0);
    expect(onOpenMiniGuide).toHaveBeenCalledTimes(1);
  });

  test("ticks the simulated playhead every second on the behind-live mock", () => {
    const { getByTestId } = render(
      <VideoPlayer
        onClose={jest.fn()}
        source={{ ...behindLiveMockSource, startPositionSeconds: 30 * 60 + 58 }}
        visible
      />,
    );

    act(() => {
      jest.advanceTimersByTime(11_000);
    });

    expect(getByTestId("programme-progress-label").props.children).toBe(
      formatLocalTime("2026-06-05T13:31:09.000Z"),
    );

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    fireEvent.press(getByTestId("player-body-toggle"));

    expect(getByTestId("programme-progress-label").props.children).toBe(
      formatLocalTime("2026-06-05T13:31:00.000Z"),
    );
  });

  test("resumes mock playback from the play/pause control", () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={liveMockSource} visible />,
    );
    const playPauseAction = getByTestId("play-pause-action");

    fireEvent(getByTestId("player-view"), "onStateChange", {
      state: "paused",
    });

    expect(playPauseAction.props.accessibilityLabel).toBe(
      "Resume live playback",
    );

    fireEvent.press(playPauseAction);

    expect(getByTestId("play-pause-action").props.accessibilityLabel).toBe(
      "Pause live playback",
    );
  });

  test("freezes the visible programme timing while playback is paused", () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={liveMockSource} visible />,
    );

    expect(getByTestId("programme-progress-label").props.children).toBe(
      formatLocalTime("2026-06-05T13:45:00.000Z"),
    );

    fireEvent(getByTestId("player-view"), "onStateChange", {
      state: "paused",
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(getByTestId("programme-progress-label").props.children).toBe(
      formatLocalTime("2026-06-05T13:45:00.000Z"),
    );
  });

  test("scrubs the simulated playhead on the behind-live mock", () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={behindLiveMockSource} visible />,
    );

    fireEvent(getByTestId("programme-progress-track"), "layout", {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(getByTestId("programme-progress-track"), "responderGrant", {
      nativeEvent: { locationX: 40 },
    });
    fireEvent(getByTestId("programme-progress-track"), "responderRelease", {
      nativeEvent: { locationX: 40 },
    });

    expect(getByTestId("programme-progress-label").props.children).toBe(
      formatLocalTime("2026-06-05T13:18:00.000Z"),
    );
  });

  test("restarts the simulated live playback from the action button", () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={liveMockSource} visible />,
    );

    fireEvent.press(getByTestId("restart-action"));

    expect(getByTestId("programme-progress-label").props.children).toBe(
      formatLocalTime("2026-06-05T13:00:00.000Z"),
    );
  });

  test("scrubs the simulated playhead on the live mock", () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={liveMockSource} visible />,
    );

    fireEvent(getByTestId("programme-progress-track"), "layout", {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(getByTestId("programme-progress-track"), "responderGrant", {
      nativeEvent: { locationX: 40 },
    });
    fireEvent(getByTestId("programme-progress-track"), "responderRelease", {
      nativeEvent: { locationX: 40 },
    });

    expect(getByTestId("programme-progress-label").props.children).toBe(
      formatLocalTime("2026-06-05T13:18:00.000Z"),
    );
  });

  test("jumps the behind-live mock to the live edge from the action button", () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={behindLiveMockSource} visible />,
    );

    act(() => {
      jest.advanceTimersByTime(11_000);
    });

    fireEvent.press(getByTestId("player-body-toggle"));
    fireEvent.press(getByTestId("go-to-live-action"));

    expect(getByTestId("programme-progress-label").props.children).toBe(
      formatLocalTime("2026-06-05T13:45:00.000Z"),
    );
  });

  test("locks phones to landscape", () => {
    render(<VideoPlayer onClose={jest.fn()} source={mockSource} visible />);

    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith("landscape");
  });

  test("follows the device orientation on tablets without locking", async () => {
    mockDeviceType = "tablet";
    mockWindowDimensions = TABLET_WINDOW;

    const { unmount } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    expect(ScreenOrientation.unlockAsync).toHaveBeenCalled();
    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalledWith("landscape");

    unmount();

    await act(async () => {});

    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalledWith("portrait-up");
  });

  test("hides system bars on phones and restores them on unmount", () => {
    const { unmount } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    expect(setStatusBarHidden).toHaveBeenCalledWith(true, "fade");

    if (Platform.OS === "android") {
      expect(NavigationBar.setVisibilityAsync).toHaveBeenCalledWith("hidden");
    }

    unmount();

    expect(setStatusBarHidden).toHaveBeenCalledWith(false, "fade");

    if (Platform.OS === "android") {
      expect(NavigationBar.setVisibilityAsync).toHaveBeenCalledWith("visible");
    }
  });

  test("leaves the system bars untouched on tablets", () => {
    mockDeviceType = "tablet";
    mockWindowDimensions = TABLET_WINDOW;

    render(<VideoPlayer onClose={jest.fn()} source={mockSource} visible />);

    expect(setStatusBarHidden).not.toHaveBeenCalled();
    expect(NavigationBar.setVisibilityAsync).not.toHaveBeenCalled();
  });

  test("closes the player on the Android hardware back button", () => {
    const onClose = jest.fn();
    const addEventListener = jest.spyOn(BackHandler, "addEventListener");

    render(<VideoPlayer onClose={onClose} source={mockSource} visible />);

    const backPressCall = addEventListener.mock.calls.find(
      ([event]) => event === "hardwareBackPress",
    );

    expect(backPressCall).toBeDefined();
    expect(backPressCall?.[1]()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);

    addEventListener.mockRestore();
  });
});

describe("<VideoPlayer /> playback errors", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-05T13:45:00.000Z"));
    process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_LICENSE_KEY = "license-key";
    jest.clearAllMocks();
    mockDeviceType = "phone";
    mockWindowDimensions = PHONE_WINDOW;
  });

  afterEach(() => {
    jest.useRealTimers();
    act(() => setDeviceOffline(false));
  });

  test("shows the playback card when the player fails to initialise", () => {
    process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_LICENSE_KEY = "";

    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <VideoPlayer onClose={onClose} source={mockSource} visible />,
    );

    getByTestId("error-modal");
    getByText("Unable to Play");
    getByText("Error code: PLAY_001");
    expect(onClose).not.toHaveBeenCalled();
  });

  test("shows the playback card for a native runtime error without leaking the raw message", () => {
    const { getByTestId, getByText, queryByText } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    act(() => {
      fireEvent(getByTestId("player-view"), "onError", {
        code: "1001",
        message: "RAW_NATIVE_PLAYER_ERROR",
      });
    });

    getByText("Unable to Play");
    expect(queryByText("RAW_NATIVE_PLAYER_ERROR")).toBeNull();
  });

  test("shows the classified code for a mid-playback failure", () => {
    const { getByTestId, getByText } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    act(() => {
      fireEvent(getByTestId("player-view"), "onError", {
        errorCode: "PLAY_001",
        errorDescription: "DRM licence request failed",
      });
    });

    getByText("Error code: PLAY_005");
  });

  test("shows the playback card for a native source error (onSourceError passthrough)", () => {
    const { getByTestId, getByText, queryByText } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    act(() => {
      fireEvent(getByTestId("player-view"), "onSourceError", {
        message: "RAW_SOURCE_LOAD_FAILURE",
      });
    });

    getByText("Unable to Play");
    expect(queryByText("RAW_SOURCE_LOAD_FAILURE")).toBeNull();
  });

  test("closes the live session when loading the source fails", async () => {
    const close = jest.fn(() => Promise.resolve());
    const source: VideoSource = {
      ...mockSource,
      playSession: {
        close,
        id: "session-load-failure",
        startKeepAlive: jest.fn(),
        stopKeepAlive: jest.fn(),
      },
    };
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={source} visible />,
    );

    getLatestPlayerControls().load.mockRejectedValueOnce(
      new Error("Source load failed"),
    );

    await waitFor(() => {
      getByTestId("error-modal");
      expect(close).toHaveBeenCalledTimes(1);
    });
  });

  test("keeps the SDK code when the source error follows onError", () => {
    const { getByTestId, getByText } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    // The SDK maps the event and calls onError before the passthrough
    act(() => {
      fireEvent(getByTestId("player-view"), "onError", {
        errorCode: "PLAY_005",
        errorDescription: "DRM license request failed",
      });
      fireEvent(getByTestId("player-view"), "onSourceError", {
        code: 2305,
        message: "DRM license request failed",
      });
    });

    getByText("Error code: PLAY_005");
  });

  test("leaves an offline start to the load error", () => {
    const { queryByText } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );

    act(() => setDeviceOffline(true));

    expect(queryByText("No internet connection")).toBeNull();
  });

  test("shows the playback card instead of loading an unsupported DASH stream on iOS", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios",
    });
    const dashSource: VideoSource = {
      ...mockSource,
      sourceType: PlaybackSourceType.DASH,
      url: "https://example.com/live.mpd",
    };

    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={dashSource} visible />,
    );

    await waitFor(() => {
      getByTestId("error-modal");
    });

    expect(getLatestPlayerControls().load).not.toHaveBeenCalled();
  });

  test("closes the player from the card", () => {
    const onClose = jest.fn();
    process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_LICENSE_KEY = "";

    const { getByTestId } = render(
      <VideoPlayer onClose={onClose} source={mockSource} visible />,
    );

    fireEvent.press(getByTestId("error-action-back"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("reloads the channel from the card", async () => {
    const { getByTestId } = render(
      <VideoPlayer onClose={jest.fn()} source={mockSource} visible />,
    );
    const playerControls = getLatestPlayerControls();

    await waitFor(() => {
      expect(playerControls.load).toHaveBeenCalledTimes(1);
    });

    act(() => {
      fireEvent(getByTestId("player-view"), "onError", {
        code: "1001",
        message: "RAW_NATIVE_PLAYER_ERROR",
      });
    });

    fireEvent.press(getByTestId("error-action-retry"));

    await waitFor(() => {
      expect(playerControls.load).toHaveBeenCalledTimes(2);
    });
  });
});
