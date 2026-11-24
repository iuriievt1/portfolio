jest.mock("@/features/auth/auth-session-context", () => ({
  ...jest.requireActual("@/features/auth/auth-session-context"),
  usePlaybackAuthorization: () => async () => true,
}));

import { ContentCatalogue, type ContentItem } from "@bfbs/common-sdk";
import { Player } from "@bfbs/common-sdk/playback/bitmovin/native";
import * as Sentry from "@sentry/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as renderWithoutProviders,
  waitFor,
} from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import type { VodAsset } from "@/features/video-player";
import { VodPlayer } from "@/features/video-player";
import { isUnsupportedSourceForPlatform } from "@/features/video-player/utils/create-load-request";
import { setDeviceOffline } from "@/infra/error/connectivity-store";

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
  ClientMetadata: {
    getFairplayServerCertificateUrl: jest.fn(),
  },
  ContentCatalogue: {
    getAsset: jest.fn(),
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
  },
  PlaySession: {
    createPlaySession: jest.fn(),
    putLastPlayPosition: jest.fn(),
  },
}));

type MockedPlayerControls = {
  bitmovinPlayer: {
    getDuration: jest.Mock;
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
let mockWindowDimensions = PHONE_WINDOW;

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

jest.mock("@/features/video-player/utils/create-load-request", () => {
  const actual = jest.requireActual(
    "@/features/video-player/utils/create-load-request",
  );

  return {
    ...actual,
    isUnsupportedSourceForPlatform: jest.fn(
      actual.isUnsupportedSourceForPlatform,
    ),
  };
});

const mockCaptureException = Sentry.captureException as jest.Mock;

const mockCreatePlaySession = jest.requireMock("@bfbs/common-sdk").PlaySession
  .createPlaySession as jest.Mock;
const mockGetAsset = jest.requireMock("@bfbs/common-sdk").ContentCatalogue
  .getAsset as jest.Mock;
const mockGetFairplayServerCertificateUrl = jest.requireMock("@bfbs/common-sdk")
  .ClientMetadata.getFairplayServerCertificateUrl as jest.Mock;

const VOD_MANIFEST_URL = "https://example.com/vod.m3u8";

const mockAsset: VodAsset = {
  id: "vod-frasier",
  title: "Frasier",
};

const mockAssetWithDuration: VodAsset = {
  durationSeconds: 300,
  id: "vod-frasier",
  title: "Frasier",
};

const queryClients = new Set<QueryClient>();

async function clearQueryClients() {
  // Failed source and session requests can settle after the player unmounts,
  // scheduling React Query's 60-second GC timer during teardown.
  await Promise.resolve();
  await Promise.resolve();
  for (const queryClient of queryClients) {
    queryClient.clear();
  }
  queryClients.clear();
}

function createContentItem(asset: VodAsset): ContentItem {
  return {
    id: asset.id,
    title: asset.title,
    ...(asset.durationSeconds === undefined
      ? {}
      : { durationSeconds: asset.durationSeconds }),
  };
}

function createPlaySession(asset: VodAsset) {
  return {
    close: jest.fn(() => Promise.resolve()),
    id: `play-session-${asset.id}`,
    manifestUrl: VOD_MANIFEST_URL,
    startKeepAlive: jest.fn(),
    stopKeepAlive: jest.fn(),
  };
}

function render(
  ui: ReactElement,
  {
    contentItem,
    seedQuery = true,
  }: { contentItem?: ContentItem; seedQuery?: boolean } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  queryClients.add(queryClient);
  const seedSource = (element: ReactElement) => {
    const asset = (element.props as { asset?: VodAsset | null }).asset;

    if (seedQuery && asset) {
      queryClient.setQueryData(
        ["vodPlayerAsset", asset.id],
        contentItem ?? createContentItem(asset),
      );
      queryClient.setQueryData(
        ["playSession", { assetId: asset.id }],
        createPlaySession(asset),
      );
    }
  };

  seedSource(ui);

  const wrap = (element: ReactElement) => (
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
  );
  const result = renderWithoutProviders(wrap(ui));

  return {
    ...result,
    rerender: (nextUi: ReactElement) => {
      seedSource(nextUi);
      result.rerender(wrap(nextUi));
    },
  };
}

afterEach(async () => {
  cleanup();
  jest.clearAllTimers();
  await clearQueryClients();
});

describe("<VodPlayer />", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_LICENSE_KEY = "license-key";
    jest.clearAllMocks();
    mockDeviceType = "phone";
    mockWindowDimensions = PHONE_WINDOW;
    mockGetAsset.mockImplementation(({ assetId }) =>
      Promise.resolve(createContentItem({ id: assetId, title: assetId })),
    );
    mockGetFairplayServerCertificateUrl.mockResolvedValue(
      "https://example.com/fairplay.cer",
    );
    mockCreatePlaySession.mockResolvedValue({
      id: "vod-session",
      manifestUrl: VOD_MANIFEST_URL,
    });
  });

  afterEach(async () => {
    cleanup();
    jest.clearAllTimers();
    await clearQueryClients();
    jest.useRealTimers();
  });

  test("creates the player with the native Bitmovin UI disabled", () => {
    render(<VodPlayer asset={mockAsset} onClose={jest.fn()} visible />);

    expect(jest.mocked(Player.createPlayer)).toHaveBeenCalledWith(
      expect.objectContaining({
        analytics: expect.objectContaining({
          licenseKey: expect.any(String),
        }),
        playerConfig: expect.objectContaining({
          styleConfig: { isUiEnabled: false },
        }),
      }),
    );
  });

  test("shows only the programme title for a single asset", () => {
    const { getByTestId, queryByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );

    expect(getByTestId("vod-player-title").props.children).toBe("Frasier");
    expect(getByTestId("vod-player-title").props.numberOfLines).toBe(1);
    expect(queryByTestId("vod-player-episode-metadata")).toBeNull();
  });

  test("shows a compact series and episode line", () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
      {
        contentItem: {
          episodeNumber: "4",
          episodeTitle: "The Candidate",
          id: mockAsset.id,
          seasonNumber: "2",
          title: mockAsset.title,
        },
      },
    );

    expect(getByTestId("vod-player-episode-metadata").props.children).toBe(
      "S2 E4 : The Candidate",
    );
    expect(getByTestId("vod-player-episode-metadata").props.numberOfLines).toBe(
      1,
    );
  });

  test("keeps the rating and hides the divider when the warning is missing", () => {
    const { getByTestId, queryByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
      {
        contentItem: {
          id: mockAsset.id,
          parentalRating: { label: "18" },
          title: mockAsset.title,
        },
      },
    );

    expect(getByTestId("age-rating-18")).toBeTruthy();
    expect(queryByTestId("vod-advisory-divider")).toBeNull();
    expect(queryByTestId("vod-content-warning")).toBeNull();
  });

  test("loads a minimal VOD request with no live-only metadata", async () => {
    render(<VodPlayer asset={mockAsset} onClose={jest.fn()} visible />);

    await waitFor(() => {
      expect(getLatestPlayerControls().load).toHaveBeenCalled();
    });

    const loadRequest = getLatestPlayerControls().load.mock.calls.at(-1)?.[0];

    expect(loadRequest).toMatchObject({
      autoplay: true,
      sessionId: "play-session-vod-frasier",
      sourceType: "hls",
      title: "Frasier",
      url: VOD_MANIFEST_URL,
    });
    expect(loadRequest).not.toHaveProperty("playSession");
    expect(loadRequest).not.toHaveProperty("asset");
    expect(loadRequest).not.toHaveProperty("channelId");
    expect(loadRequest).not.toHaveProperty("programme");
  });

  test("ignores a non-finite position update instead of rendering NaN", async () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );

    await waitFor(() => {
      expect(getLatestPlayerControls().load).toHaveBeenCalled();
    });

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 30,
    });

    expect(getByTestId("vod-elapsed-label").props.children).toBe("00:30");

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: Number.NaN,
    });

    expect(getByTestId("vod-elapsed-label").props.children).toBe("00:30");
  });

  test("treats a non-positive metadata duration as unknown", async () => {
    const { getByTestId } = render(
      <VodPlayer
        asset={{ durationSeconds: 0, id: "vod-zero", title: "Zero" }}
        onClose={jest.fn()}
        visible
      />,
    );

    await waitFor(() => {
      expect(getLatestPlayerControls().load).toHaveBeenCalled();
    });

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 5,
    });

    expect(getByTestId("vod-remaining-label").props.children).toBe("");
  });

  test("pauses playback from the play/pause control", async () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );
    const playerControls = getLatestPlayerControls();

    fireEvent(getByTestId("player-view"), "onStateChange", {
      state: "playing",
    });
    fireEvent.press(getByTestId("vod-play-pause-action"));

    expect(playerControls.pause).toHaveBeenCalledTimes(1);
  });

  test("resumes playback from the play/pause control", () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );
    const playerControls = getLatestPlayerControls();

    fireEvent(getByTestId("player-view"), "onStateChange", {
      state: "paused",
    });

    expect(getByTestId("vod-play-pause-action").props.accessibilityLabel).toBe(
      "Resume playback",
    );

    fireEvent.press(getByTestId("vod-play-pause-action"));

    expect(playerControls.play).toHaveBeenCalledTimes(1);
    expect(getByTestId("vod-play-pause-action").props.accessibilityLabel).toBe(
      "Pause playback",
    );
  });

  test("seeks to an absolute position on the 0-to-duration timeline", () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAssetWithDuration} onClose={jest.fn()} visible />,
    );
    const playerControls = getLatestPlayerControls();

    fireEvent(getByTestId("vod-progress-track"), "layout", {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(getByTestId("vod-progress-track"), "responderGrant", {
      nativeEvent: { locationX: 40 },
    });
    fireEvent(getByTestId("vod-progress-track"), "responderRelease", {
      nativeEvent: { locationX: 40 },
    });

    expect(playerControls.seek).toHaveBeenCalledWith(60);
  });

  test("exposes the playback position to screen readers", () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAssetWithDuration} onClose={jest.fn()} visible />,
    );
    const progressTrack = getByTestId("vod-progress-track");

    expect(progressTrack.props).toMatchObject({
      accessibilityActions: [{ name: "increment" }, { name: "decrement" }],
      accessibilityHint: "Swipe up or down to seek by 10 seconds",
      accessibilityLabel: "Playback position",
      accessibilityRole: "adjustable",
      accessibilityState: { disabled: false },
      accessibilityValue: {
        max: 300,
        min: 0,
        now: 0,
        text: "00:00 of 05:00",
      },
      accessible: true,
    });

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 65,
    });

    expect(getByTestId("vod-progress-track").props.accessibilityValue).toEqual({
      max: 300,
      min: 0,
      now: 65,
      text: "01:05 of 05:00",
    });
  });

  test("adjusts playback position through screen-reader actions", () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAssetWithDuration} onClose={jest.fn()} visible />,
    );
    const playerControls = getLatestPlayerControls();
    const progressTrack = getByTestId("vod-progress-track");

    fireEvent(progressTrack, "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    });

    expect(playerControls.seek).toHaveBeenLastCalledWith(10);

    fireEvent(progressTrack, "accessibilityAction", {
      nativeEvent: { actionName: "decrement" },
    });

    expect(playerControls.seek).toHaveBeenLastCalledWith(0);
  });

  test("keeps the scrub position stable when the finger moves vertically", () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAssetWithDuration} onClose={jest.fn()} visible />,
    );
    const playerControls = getLatestPlayerControls();
    const progressTrack = getByTestId("vod-progress-track");

    fireEvent(progressTrack, "layout", {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(progressTrack, "responderGrant", {
      nativeEvent: { locationX: 100, pageX: 300, pageY: 400 },
    });
    fireEvent(progressTrack, "responderMove", {
      nativeEvent: { locationX: 20, pageX: 300, pageY: 440 },
    });
    fireEvent(progressTrack, "responderRelease");

    expect(playerControls.seek).toHaveBeenLastCalledWith(150);
  });

  test("positions the playhead without adding a scrub-time label", () => {
    const { getByTestId, queryByTestId } = render(
      <VodPlayer asset={mockAssetWithDuration} onClose={jest.fn()} visible />,
    );

    fireEvent(getByTestId("vod-progress-track"), "layout", {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 150,
    });

    expect(getByTestId("vod-progress-playhead")).toHaveStyle({
      height: 18,
      transform: [{ translateX: 91 }],
      width: 18,
    });
    expect(queryByTestId("vod-scrub-time-label")).toBeNull();
  });

  test("holds the seek target instead of rubber-banding to a stale position", () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAssetWithDuration} onClose={jest.fn()} visible />,
    );

    fireEvent(getByTestId("vod-progress-track"), "layout", {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(getByTestId("vod-progress-track"), "responderGrant", {
      nativeEvent: { locationX: 40 },
    });
    fireEvent(getByTestId("vod-progress-track"), "responderRelease", {
      nativeEvent: { locationX: 40 },
    });

    expect(getByTestId("vod-elapsed-label").props.children).toBe("01:00");

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 10,
    });

    expect(getByTestId("vod-elapsed-label").props.children).toBe("01:00");

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 60,
    });
    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 62,
    });

    expect(getByTestId("vod-elapsed-label").props.children).toBe("01:02");
  });

  test("delays the initial spinner until three seconds and hides it on playback", () => {
    const { getByTestId, queryByTestId } = render(
      <VodPlayer asset={mockAssetWithDuration} onClose={jest.fn()} visible />,
    );

    act(() => jest.advanceTimersByTime(2999));
    expect(queryByTestId("player-loading-indicator")).toBeNull();

    act(() => jest.advanceTimersByTime(1));
    expect(getByTestId("player-loading-indicator")).toBeTruthy();

    fireEvent(getByTestId("player-view"), "onStateChange", {
      state: "playing",
    });
    expect(queryByTestId("player-loading-indicator")).toBeNull();
  });

  test("never flashes the initial spinner when playback starts within three seconds", () => {
    const { getByTestId, queryByTestId } = render(
      <VodPlayer asset={mockAssetWithDuration} onClose={jest.fn()} visible />,
    );

    act(() => jest.advanceTimersByTime(1000));
    fireEvent(getByTestId("player-view"), "onStateChange", {
      state: "playing",
    });
    act(() => jest.advanceTimersByTime(1500));

    expect(queryByTestId("player-loading-indicator")).toBeNull();
  });

  test("shows the spinner immediately for the duration of a rebuffer", () => {
    const { getByTestId, queryByTestId } = render(
      <VodPlayer asset={mockAssetWithDuration} onClose={jest.fn()} visible />,
    );
    const playerView = getByTestId("player-view");

    fireEvent(playerView, "onStateChange", { state: "playing" });
    expect(queryByTestId("player-loading-indicator")).toBeNull();

    fireEvent(playerView, "onStateChange", { state: "buffering" });
    expect(getByTestId("player-loading-indicator")).toBeTruthy();

    fireEvent(playerView, "onStateChange", { state: "playing" });
    expect(queryByTestId("player-loading-indicator")).toBeNull();
  });

  test("shows elapsed time and total duration from the metadata duration", async () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAssetWithDuration} onClose={jest.fn()} visible />,
    );

    await waitFor(() => {
      expect(getLatestPlayerControls().load).toHaveBeenCalled();
    });

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 65,
    });

    expect(getByTestId("vod-elapsed-label").props.children).toBe("01:05");
    expect(getByTestId("vod-remaining-label").props.children).toBe("05:00");
  });

  test("renders the exact playhead seconds without float rounding drift", async () => {
    const { getByTestId } = render(
      <VodPlayer
        asset={{ durationSeconds: 22, id: "vod-odd", title: "Odd" }}
        onClose={jest.fn()}
        visible
      />,
    );

    await waitFor(() => {
      expect(getLatestPlayerControls().load).toHaveBeenCalled();
    });

    fireEvent(getByTestId("player-view"), "onTimeUpdate", {
      positionSeconds: 15,
    });

    expect(getByTestId("vod-elapsed-label").props.children).toBe("00:15");
    expect(getByTestId("vod-remaining-label").props.children).toBe("00:22");
  });

  test("resolves duration from the native player when metadata omits it", async () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );
    const playerControls = getLatestPlayerControls();
    playerControls.bitmovinPlayer.getDuration.mockResolvedValue(300);

    await waitFor(() => {
      expect(playerControls.load).toHaveBeenCalled();
    });

    fireEvent(getByTestId("player-view"), "onStateChange", {
      positionSeconds: 65,
      state: "playing",
    });

    await waitFor(() => {
      expect(getByTestId("vod-remaining-label").props.children).toBe("05:00");
    });
  });

  test("leaves the duration unknown when the native probe is non-finite", async () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );
    const playerControls = getLatestPlayerControls();
    playerControls.bitmovinPlayer.getDuration.mockResolvedValue(Number.NaN);

    await waitFor(() => {
      expect(playerControls.load).toHaveBeenCalled();
    });

    fireEvent(getByTestId("player-view"), "onStateChange", {
      positionSeconds: 5,
      state: "playing",
    });

    await waitFor(() => {
      expect(playerControls.bitmovinPlayer.getDuration).toHaveBeenCalled();
    });

    expect(getByTestId("vod-remaining-label").props.children).toBe("");
  });

  test("does not seek while the duration is still unknown", () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );
    const playerControls = getLatestPlayerControls();

    fireEvent(getByTestId("vod-progress-track"), "layout", {
      nativeEvent: { layout: { width: 200 } },
    });
    fireEvent(getByTestId("vod-progress-track"), "responderGrant", {
      nativeEvent: { locationX: 100 },
    });
    fireEvent(getByTestId("vod-progress-track"), "responderRelease", {
      nativeEvent: { locationX: 100 },
    });

    expect(playerControls.seek).not.toHaveBeenCalled();
    expect(getByTestId("vod-progress-track").props).toMatchObject({
      accessibilityActions: [],
      accessibilityRole: "adjustable",
      accessibilityState: { disabled: true },
      accessibilityValue: { text: "Duration unavailable" },
    });
  });

  test("pauses the underlying player when it becomes hidden", async () => {
    const { rerender } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );
    const playerControls = getLatestPlayerControls();

    await waitFor(() => {
      expect(playerControls.load).toHaveBeenCalled();
    });

    playerControls.pause.mockClear();

    rerender(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible={false} />,
    );

    expect(playerControls.pause).toHaveBeenCalledTimes(1);
  });
});

describe("<VodPlayer /> playback errors", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_LICENSE_KEY = "license-key";
    jest.clearAllMocks();
    mockDeviceType = "phone";
    mockWindowDimensions = PHONE_WINDOW;
    mockGetAsset.mockImplementation(({ assetId }) =>
      Promise.resolve(createContentItem({ id: assetId, title: assetId })),
    );
    mockGetFairplayServerCertificateUrl.mockResolvedValue(
      "https://example.com/fairplay.cer",
    );
    mockCreatePlaySession.mockResolvedValue({
      id: "vod-session",
      manifestUrl: VOD_MANIFEST_URL,
    });
  });

  afterEach(async () => {
    cleanup();
    jest.clearAllTimers();
    await clearQueryClients();
    jest.useRealTimers();
    act(() => setDeviceOffline(false));
  });

  test("shows the unable-to-play card when the player fails to initialise", () => {
    process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_LICENSE_KEY = "";

    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <VodPlayer asset={mockAsset} onClose={onClose} visible />,
    );

    getByTestId("error-modal");
    getByText("Unable to Play");
    getByText("Error code: PLAY_001");
    expect(onClose).not.toHaveBeenCalled();
  });

  test("shows the generic playback card for a native runtime error", () => {
    const { getByTestId, getByText, queryByText } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );

    act(() => {
      fireEvent(getByTestId("player-view"), "onError", {
        errorCode: "PLAY_001",
        errorDescription: "RAW_NATIVE_PLAYER_ERROR",
        position: 0,
        sessionId: "",
      });
    });

    getByText("Unable to Play");
    getByText(
      "We couldn't start this video. Try again or choose something else.",
    );
    expect(queryByText("RAW_NATIVE_PLAYER_ERROR")).toBeNull();
    expect(mockCaptureException).toHaveBeenCalled();
  });

  test("shows the format card for an unsupported-format player error", () => {
    const { getByTestId, getByText } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );

    act(() => {
      fireEvent(getByTestId("player-view"), "onError", {
        errorCode: "PLAY_006",
        errorDescription: "The manifest format is not supported",
        position: 0,
        sessionId: "",
      });
    });

    getByText("Format not supported");
    getByTestId("error-action-updateApp");
  });

  test("shows the unable-to-play card for a native source error", () => {
    const { getByTestId, getByText, queryByText } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );

    act(() => {
      fireEvent(getByTestId("player-view"), "onSourceError", {
        message: "RAW_SOURCE_LOAD_FAILURE",
      });
    });

    getByText("Unable to Play");
    expect(queryByText("RAW_SOURCE_LOAD_FAILURE")).toBeNull();
    expect(mockCaptureException).toHaveBeenCalled();
  });

  test("leaves an offline start to the load error", () => {
    const { queryByText } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );

    act(() => setDeviceOffline(true));

    expect(queryByText("No internet connection")).toBeNull();
  });

  test("closes the player from the card", async () => {
    const onClose = jest.fn();
    process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_LICENSE_KEY = "";

    const { getByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={onClose} visible />,
    );

    fireEvent.press(getByTestId("error-action-back"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  test("reloads playback from the card", async () => {
    const { getByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );
    const playerControls = getLatestPlayerControls();

    await waitFor(() => {
      expect(playerControls.load).toHaveBeenCalledTimes(1);
    });

    act(() => {
      fireEvent(getByTestId("player-view"), "onError", {
        errorCode: "PLAY_001",
        errorDescription: "RAW_NATIVE_PLAYER_ERROR",
        position: 0,
        sessionId: "",
      });
    });

    fireEvent.press(getByTestId("error-action-retry"));

    await waitFor(() => {
      expect(playerControls.load).toHaveBeenCalledTimes(2);
    });
  });

  test("shows the unreachable-server card for a Common SDK source failure", async () => {
    const sourceError = new TypeError("Network request failed");

    jest.mocked(ContentCatalogue.getAsset).mockRejectedValueOnce(sourceError);

    const { getByText } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
      { seedQuery: false },
    );

    await waitFor(() => {
      getByText("We're having trouble connecting");
    });
  });

  test("leaves a way out of a card whose only action retries", async () => {
    const onClose = jest.fn();

    jest
      .mocked(ContentCatalogue.getAsset)
      .mockRejectedValue(new TypeError("Network request failed"));

    const { getByTestId } = render(
      <VodPlayer asset={mockAsset} onClose={onClose} visible />,
      { seedQuery: false },
    );

    await waitFor(() => {
      getByTestId("error-action-back");
    });

    fireEvent.press(getByTestId("error-action-back"));

    expect(onClose).toHaveBeenCalled();
  });

  test("shows the generic playback card for a state-only ERROR change", () => {
    const { getByTestId, getByText } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );

    act(() => {
      fireEvent(getByTestId("player-view"), "onStateChange", {
        state: "error",
      });
    });

    getByText("Unable to Play");
    getByTestId("error-action-retry");
  });

  test("shows the format card for an unsupported iOS source", async () => {
    jest.mocked(isUnsupportedSourceForPlatform).mockReturnValueOnce(true);

    const { getByTestId, getByText } = render(
      <VodPlayer asset={mockAsset} onClose={jest.fn()} visible />,
    );

    await waitFor(() => {
      getByTestId("error-modal");
    });

    getByText("Format not supported");
  });

  test("shows a card when the play session cannot be created", async () => {
    mockCreatePlaySession.mockRejectedValueOnce(new Error("session failed"));

    const { getByTestId } = render(
      <VodPlayer
        asset={{ id: "vod-broken", title: "Broken" }}
        onClose={jest.fn()}
        visible
      />,
      { seedQuery: false },
    );

    await waitFor(() => {
      getByTestId("error-modal");
    });

    getByTestId("error-action-retry");
  });

  test("shows the region-restricted card when Synamedia geo-blocks the asset", async () => {
    mockCreatePlaySession.mockRejectedValueOnce(
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

    const { getByText } = render(
      <VodPlayer
        asset={{ id: "vod-geo-blocked", title: "Blocked" }}
        onClose={jest.fn()}
        visible
      />,
      { seedQuery: false },
    );

    await waitFor(() => {
      getByText("Not Available in Your Region");
    });
  });
});
