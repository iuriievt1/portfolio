import {
  DeviceClass,
  EventType,
  AppState as GoAppState,
} from "@bfbs/common-sdk";
import { AppState, type AppStateStatus } from "react-native";
import {
  stopAppAnalytics,
  trackAppStart,
  trackPostLoginAppStart,
} from "@/features/analytics/app-analytics";

const mockTrack = jest.fn();
const mockHasSession = jest.fn(() => true);
const mockTrackNetworkChanges = jest.fn();
const mockStopNetworkChanges = jest.fn();

jest.mock("@/features/analytics/analytics-manager", () => ({
  analyticsManager: { track: (event: unknown) => mockTrack(event) },
}));

jest.mock("@/infra/common-sdk/configure-common-sdk", () => ({
  getGoAnalyticsApplicationMetadata: () => ({
    appVersion: "4.2.0",
    deviceName: "Test device",
    deviceOs: "ios 18.2",
    uiLanguage: "en",
  }),
}));

jest.mock("@/features/auth/utils/synamedia-storage", () => ({
  hasStoredSynamediaAuthSession: () => mockHasSession(),
}));

jest.mock("@/features/analytics/network-analytics", () => ({
  stopNetworkChanges: () => mockStopNetworkChanges(),
  trackNetworkChanges: () => mockTrackNetworkChanges(),
}));

jest.mock("@/infra/error/utils/report-error", () => ({
  reportError: jest.fn(),
}));

const remove = jest.fn();
let sendAppState: (state: AppStateStatus) => void;

const appStart = { type: EventType.APP_START, data: {} };

function discovery(isRegistered: boolean) {
  return {
    type: EventType.APP_DISCOVERY,
    data: {
      appVersion: "4.2.0",
      deviceClass: DeviceClass.MOBILE,
      deviceInfo: { name: "Test device", os: "ios 18.2" },
      isRegistered,
      uiLanguage: "en",
    },
  };
}

function appStateChange(state: GoAppState) {
  return { type: EventType.APP_STATE_CHANGE, data: { state } };
}

// The events sent, in order.
function sentEvents() {
  return mockTrack.mock.calls.map(([event]) => event);
}

describe("app analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasSession.mockReturnValue(true);
    // RN's Jest mock makes currentState a function, so set it directly.
    AppState.currentState = "active";
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        sendAppState = listener;
        return { remove };
      });
  });

  afterEach(() => {
    stopAppAnalytics();
    jest.restoreAllMocks();
  });

  test("sends APP_START, then APP_DISCOVERY, on launch", () => {
    trackAppStart();

    expect(sentEvents()).toEqual([appStart, discovery(true)]);
    expect(mockTrackNetworkChanges).toHaveBeenCalledTimes(1);

    const lastEventSent = Math.max(...mockTrack.mock.invocationCallOrder);
    const networkStarted = Math.min(
      ...mockTrackNetworkChanges.mock.invocationCallOrder,
    );
    expect(networkStarted).toBeGreaterThan(lastEventSent);
  });

  test("sends fresh APP_DISCOVERY before APP_START after sign-in", () => {
    trackPostLoginAppStart();

    expect(sentEvents()).toEqual([discovery(true), appStart]);
  });

  test("sends APP_START only once per launch", () => {
    trackAppStart();
    trackAppStart();

    expect(sentEvents()).toEqual([appStart, discovery(true)]);
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
  });

  test("sends APP_STATE_CHANGE on background, and fresh APP_DISCOVERY on foreground", () => {
    trackAppStart();
    mockTrack.mockClear();

    sendAppState("background");
    // Signed out while away, so the new discovery must say so.
    mockHasSession.mockReturnValue(false);
    sendAppState("active");

    expect(sentEvents()).toEqual([
      appStateChange(GoAppState.BACKGROUND),
      appStateChange(GoAppState.FOREGROUND),
      discovery(false),
    ]);
  });

  test("skips inactive and repeated states", () => {
    trackAppStart();
    mockTrack.mockClear();

    sendAppState("inactive");
    sendAppState("active");
    sendAppState("background");
    sendAppState("background");

    expect(sentEvents()).toEqual([appStateChange(GoAppState.BACKGROUND)]);
  });

  test("stopAppAnalytics removes the listeners so a new start sends APP_START again", () => {
    trackAppStart();
    stopAppAnalytics();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(mockStopNetworkChanges).toHaveBeenCalledTimes(1);

    mockTrack.mockClear();
    trackAppStart();

    expect(sentEvents()).toEqual([appStart, discovery(true)]);
  });
});
