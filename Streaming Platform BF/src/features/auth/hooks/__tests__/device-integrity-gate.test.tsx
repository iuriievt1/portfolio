import { CancelledError, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { type PropsWithChildren, useEffect } from "react";
import { AppState, type AppStateStatus, Pressable, Text } from "react-native";
import { usePlaybackLauncher } from "@/features/video-player/hooks/use-playback-launcher";
import { preparePlayback } from "@/features/video-player/prepare-playback";
import {
  dismissErrorModal,
  errorModalStore,
  showErrorModal,
} from "@/infra/error";
import { featurevisorService } from "@/infra/feature-flags/featurevisor-service";
import { appQueryClient } from "@/infra/query/app-query-client";
import { SynamediaAuthGate } from "../../components/synamedia-auth-gate";
import {
  consumeSignInRequest,
  requestSignIn,
} from "../../sign-in-request-store";
import { useSynamediaAuthGate } from "../use-synamedia-auth-gate";

const mockHasSession = jest.fn(() => true);
const mockBootstrap = jest.fn(async () => {});
const mockSignIn = jest.fn(async () => {});
const mockSignOut = jest.fn(async () => {});
const mockIntegrityCheck = jest.fn(async () => ({ status: "passed" }));
const mockCreateSession = jest.fn();
const mockFairplayCertificate = jest.fn();
const mockIsDeviceQuotaReached = jest.fn(async () => false);
const mockPush = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../../../../__mocks__/common-sdk-enums"),
  Auth: {
    bootstrapSession: () => mockBootstrap(),
    signIn: () => mockSignIn(),
    signOut: () => mockSignOut(),
  },
  DeviceIntegrity: { check: () => mockIntegrityCheck() },
  DeviceIntegrityStatus: {
    PASSED: "passed",
    FAILED: "failed",
    INCONCLUSIVE: "inconclusive",
  },
  PlaySession: {
    createPlaySession: (...args: unknown[]) => mockCreateSession(...args),
  },
  ClientMetadata: {
    getFairplayServerCertificateUrl: () => mockFairplayCertificate(),
  },
}));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("../../utils/synamedia-storage", () => ({
  hasStoredSynamediaAuthSession: () => mockHasSession(),
}));
jest.mock("../../utils/device-quota", () => ({
  isDeviceQuotaReached: () => mockIsDeviceQuotaReached(),
}));
jest.mock("@/features/analytics/logon-analytics", () => ({
  trackSignIn: jest.fn(),
  trackSignOut: jest.fn(),
}));
jest.mock("@/features/analytics/app-analytics", () => ({
  trackPostLoginAppStart: jest.fn(),
}));
jest.mock("../../utils/pending-device-registration", () => ({
  clearPendingDeviceRegistration: jest.fn(),
  hasPendingDeviceRegistration: () => false,
  setPendingDeviceRegistration: jest.fn(),
}));
jest.mock("@/infra/error", () => ({
  ...jest.requireActual("@/infra/error"),
  reportError: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock("@/features/analytics/screens/route-screen-change-tracker", () => ({
  RouteScreenChangeTracker: () => null,
}));

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={appQueryClient}>
      {children}
    </QueryClientProvider>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

let changeAppState: (state: AppStateStatus) => void;
const removeListener = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  featurevisorService.setOverrides({});
  mockHasSession.mockReturnValue(true);
  mockIntegrityCheck.mockReset().mockResolvedValue({ status: "passed" });
  mockBootstrap.mockReset().mockResolvedValue();
  mockSignOut.mockReset().mockResolvedValue();
  mockSignIn.mockReset().mockResolvedValue();
  mockIsDeviceQuotaReached.mockReset().mockResolvedValue(false);
  consumeSignInRequest();
  dismissErrorModal();
  appQueryClient.clear();
  appQueryClient.setDefaultOptions({
    mutations: { gcTime: 0, retry: false },
    queries: { gcTime: 0, retry: false },
  });
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, listener) => {
      changeAppState = listener;
      return { remove: removeListener };
    });
});

afterEach(() => {
  appQueryClient.clear();
  jest.restoreAllMocks();
});

async function foreground() {
  await act(async () => {
    changeAppState("background");
    changeAppState("inactive");
    changeAppState("active");
  });
}

test.each([
  "passed",
  "inconclusive",
])("allows a restored session with %s integrity", async (status) => {
  mockIntegrityCheck.mockResolvedValue({ status });
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  expect(mockIntegrityCheck).toHaveBeenCalledTimes(1);
  expect(mockBootstrap.mock.invocationCallOrder[0]).toBeLessThan(
    mockIntegrityCheck.mock.invocationCallOrder[0] ?? 0,
  );
});

test("keeps restored content gated until the check finishes, then blocks a failure without signing out", async () => {
  const check = deferred<{ status: string }>();
  mockIntegrityCheck.mockReturnValueOnce(check.promise);
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(mockIntegrityCheck).toHaveBeenCalledTimes(1));
  expect(result.current.state.status).toBe("bootstrapping");
  await act(async () => check.resolve({ status: "failed" }));
  expect(result.current.state.status).toBe("device-not-authorised");
  expect(mockSignOut).not.toHaveBeenCalled();
});

test("does not check signed-out users on startup, foreground or playback requests", async () => {
  mockHasSession.mockReturnValue(false);
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await foreground();
  await expect(result.current.checkAuthenticatedDevice()).resolves.toBe(false);
  expect(result.current.state.status).toBe("signed-out");
  expect(mockIntegrityCheck).not.toHaveBeenCalled();
});

test("a background return during bootstrap still checks integrity before opening content", async () => {
  const bootstrap = deferred<void>();
  mockBootstrap.mockReturnValueOnce(bootstrap.promise);
  mockIntegrityCheck.mockResolvedValue({ status: "failed" });
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(mockBootstrap).toHaveBeenCalledTimes(1));
  await foreground();
  expect(result.current.state.status).toBe("bootstrapping");
  expect(mockIntegrityCheck).not.toHaveBeenCalled();
  await act(async () => bootstrap.resolve());
  expect(result.current.state.status).toBe("device-not-authorised");
  expect(mockIntegrityCheck).toHaveBeenCalledTimes(1);
});

test("checks a successful login and blocks it before revealing content", async () => {
  mockHasSession.mockReturnValue(false);
  mockIntegrityCheck.mockResolvedValue({ status: "failed" });
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  act(() =>
    result.current.signIn({ username: "viewer", password: "password" }),
  );
  await waitFor(() =>
    expect(result.current.state.status).toBe("device-not-authorised"),
  );
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  expect(mockIntegrityCheck).toHaveBeenCalledTimes(1);
});

test("does not treat failed authentication as an authenticated device", async () => {
  mockHasSession.mockReturnValue(false);
  mockSignIn.mockRejectedValueOnce(new Error("Invalid credentials"));
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  act(() => result.current.signIn({ username: "viewer", password: "wrong" }));
  await waitFor(() => expect(result.current.signInErrorCode).not.toBeNull());
  expect(mockIntegrityCheck).not.toHaveBeenCalled();
});

test("rechecks only after a background return and removes the listener on unmount", async () => {
  const { result, unmount } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  await act(async () => {
    changeAppState("active");
    changeAppState("inactive");
    changeAppState("active");
  });
  expect(mockIntegrityCheck).toHaveBeenCalledTimes(1);
  mockIntegrityCheck.mockResolvedValueOnce({ status: "failed" });
  await foreground();
  expect(mockIntegrityCheck).toHaveBeenCalledTimes(2);
  expect(result.current.state.status).toBe("device-not-authorised");
  await foreground();
  expect(mockIntegrityCheck).toHaveBeenCalledTimes(2);
  unmount();
  expect(removeListener).toHaveBeenCalledTimes(1);
});

test.each([
  "passed",
  "failed",
])("ignores a pending %s result as soon as logout starts", async (status) => {
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  const check = deferred<{ status: string }>();
  const logout = deferred<void>();
  mockIntegrityCheck.mockReturnValueOnce(check.promise);
  mockSignOut.mockReturnValueOnce(logout.promise);
  const authorization = result.current.checkAuthenticatedDevice();
  let signingOut!: Promise<void>;
  act(() => {
    signingOut = result.current.signOut();
  });
  await act(async () => check.resolve({ status }));
  await expect(authorization).resolves.toBe(false);
  await act(async () => {
    logout.resolve();
    await signingOut;
  });
  expect(result.current.state.status).toBe("signed-out");
});

test("a pending restored check cannot revive a session after a sign-in request", async () => {
  const check = deferred<{ status: string }>();
  mockIntegrityCheck.mockReturnValueOnce(check.promise);
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(mockIntegrityCheck).toHaveBeenCalledTimes(1));
  await act(async () => requestSignIn());
  await act(async () => check.resolve({ status: "passed" }));
  expect(result.current.state.status).toBe("signed-out");
});

test("a concurrent passing playback check cannot undo a foreground failure", async () => {
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  const check = deferred<{ status: string }>();
  mockIntegrityCheck
    .mockReturnValueOnce(check.promise)
    .mockResolvedValueOnce({ status: "failed" });
  const authorization = result.current.checkAuthenticatedDevice();
  await foreground();
  await act(async () => check.resolve({ status: "passed" }));
  await expect(authorization).resolves.toBe(false);
  expect(result.current.state.status).toBe("device-not-authorised");
});

function PlaybackHarness({ onUnmount }: { onUnmount: () => void }) {
  const { openLiveChannel } = usePlaybackLauncher();
  useEffect(() => onUnmount, [onUnmount]);
  return (
    <Pressable testID="play" onPress={() => void openLiveChannel("channel-1")}>
      <Text>App content</Text>
    </Pressable>
  );
}

test("skips native checks at every trigger while the flag is disabled", async () => {
  featurevisorService.setOverrides({ "auth.deviceIntegrity": false });
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  await foreground();
  await expect(result.current.checkAuthenticatedDevice()).resolves.toBe(true);
  await act(async () => result.current.signOut());
  act(() =>
    result.current.signIn({ username: "viewer", password: "password" }),
  );
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  expect(mockIntegrityCheck).not.toHaveBeenCalled();
});

test("rechecks when enforcement is enabled and releases AUTH_019 when disabled", async () => {
  featurevisorService.setOverrides({ "auth.deviceIntegrity": false });
  mockIntegrityCheck.mockResolvedValue({ status: "failed" });
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  await act(async () =>
    featurevisorService.setOverrides({ "auth.deviceIntegrity": true }),
  );
  expect(result.current.state.status).toBe("device-not-authorised");
  await act(async () =>
    featurevisorService.setOverrides({ "auth.deviceIntegrity": false }),
  );
  expect(result.current.state.status).toBe("ready");
  expect(mockIntegrityCheck).toHaveBeenCalledTimes(1);
});

test("disabling enforcement immediately releases a pending startup check and ignores its later failure", async () => {
  const check = deferred<{ status: string }>();
  mockIntegrityCheck.mockReturnValueOnce(check.promise);
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(mockIntegrityCheck).toHaveBeenCalledTimes(1));
  await act(async () =>
    featurevisorService.setOverrides({ "auth.deviceIntegrity": false }),
  );
  expect(result.current.state.status).toBe("ready");
  await act(async () => check.resolve({ status: "failed" }));
  expect(result.current.state.status).toBe("ready");
});

test.each([
  "passed",
  "failed",
])("ignores a stale %s check after enforcement is disabled and enabled again", async (status) => {
  const check = deferred<{ status: string }>();
  mockIntegrityCheck
    .mockReturnValueOnce(check.promise)
    .mockResolvedValueOnce({ status: "failed" });
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(mockIntegrityCheck).toHaveBeenCalledTimes(1));
  await act(async () => {
    featurevisorService.setOverrides({ "auth.deviceIntegrity": false });
    featurevisorService.setOverrides({ "auth.deviceIntegrity": true });
  });
  expect(result.current.state.status).toBe("device-not-authorised");
  await act(async () => check.resolve({ status }));
  expect(result.current.state.status).toBe("device-not-authorised");
  expect(mockIntegrityCheck).toHaveBeenCalledTimes(2);
});

test("flag changes never check a signed-out user", async () => {
  mockHasSession.mockReturnValue(false);
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await act(async () => {
    featurevisorService.setOverrides({ "auth.deviceIntegrity": false });
    featurevisorService.setOverrides({ "auth.deviceIntegrity": true });
  });
  expect(result.current.state.status).toBe("signed-out");
  expect(mockIntegrityCheck).not.toHaveBeenCalled();
});

test("disabling integrity returns a quota-limited login to device management", async () => {
  mockHasSession.mockReturnValue(false);
  mockBootstrap.mockRejectedValueOnce(new Error("Device quota reached"));
  mockIsDeviceQuotaReached.mockResolvedValue(true);
  mockIntegrityCheck.mockResolvedValue({ status: "failed" });
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  act(() =>
    result.current.signIn({ username: "viewer", password: "password" }),
  );
  await waitFor(() =>
    expect(result.current.state.status).toBe("device-not-authorised"),
  );
  await act(async () =>
    featurevisorService.setOverrides({ "auth.deviceIntegrity": false }),
  );
  expect(result.current.state.status).toBe("too-many-devices");
  await expect(result.current.checkAuthenticatedDevice()).resolves.toBe(false);
});

test("closes a session that finishes opening after a foreground failure", async () => {
  const session = deferred<{
    id: string;
    manifestUrl: string;
    close: () => Promise<void>;
  }>();
  const close = jest.fn(async () => {});
  mockCreateSession.mockReturnValueOnce(session.promise);
  const view = render(
    <SynamediaAuthGate>
      <PlaybackHarness onUnmount={jest.fn()} />
    </SynamediaAuthGate>,
    { wrapper },
  );
  await waitFor(() => expect(view.getByTestId("play")).toBeTruthy());
  await act(async () => fireEvent.press(view.getByTestId("play")));
  await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));
  mockIntegrityCheck.mockResolvedValue({ status: "failed" });
  await foreground();
  await act(async () =>
    session.resolve({
      id: "session-1",
      manifestUrl: "https://example.com/live.m3u8",
      close,
    }),
  );
  expect(close).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();
  expect(view.getByText("AUTH_019")).toBeTruthy();
});

test("an integrity failure rejects preparation instead of returning a cached session", async () => {
  const { result } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  appQueryClient.setQueryData(["playSession", { channelId: "channel-1" }], {
    id: "cached-session",
    manifestUrl: "https://example.com/live.m3u8",
    close: jest.fn(async () => {}),
  });
  mockIntegrityCheck.mockResolvedValue({ status: "failed" });
  await act(async () => {
    await expect(
      preparePlayback(
        appQueryClient,
        { kind: "live", channelId: "channel-1" },
        result.current.checkAuthenticatedDevice,
      ),
    ).rejects.toBeInstanceOf(CancelledError);
  });
  expect(result.current.state.status).toBe("device-not-authorised");
  expect(mockCreateSession).not.toHaveBeenCalled();
});

test("closes an already prepared session when integrity fails during the FairPlay certificate request", async () => {
  const certificate = deferred<string>();
  const close = jest.fn(async () => {});
  mockCreateSession.mockResolvedValueOnce({
    id: "fairplay-session",
    close,
    drmType: "fpDrm",
    manifestUrl: "https://example.com/live.m3u8",
    drmProperties: { laUrl: "https://example.com/license", blob: "token" },
  });
  mockFairplayCertificate.mockReturnValueOnce(certificate.promise);
  const view = render(
    <SynamediaAuthGate>
      <PlaybackHarness onUnmount={jest.fn()} />
    </SynamediaAuthGate>,
    { wrapper },
  );
  await waitFor(() => expect(view.getByTestId("play")).toBeTruthy());
  await act(async () => fireEvent.press(view.getByTestId("play")));
  await waitFor(() => expect(mockFairplayCertificate).toHaveBeenCalledTimes(1));
  mockIntegrityCheck.mockResolvedValue({ status: "failed" });
  await foreground();
  expect(close).toHaveBeenCalledTimes(1);
  expect(
    appQueryClient.getQueryData(["playSession", { channelId: "channel-1" }]),
  ).toBeUndefined();
  await act(async () => certificate.resolve("https://example.com/certificate"));
  expect(close).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();
  expect(errorModalStore.getState().code).toBeNull();
  expect(view.getByText("AUTH_019")).toBeTruthy();
});

test("does not reopen content when a pending check finishes after unmount", async () => {
  const check = deferred<{ status: string }>();
  mockIntegrityCheck.mockReturnValueOnce(check.promise);
  const { unmount } = renderHook(useSynamediaAuthGate, { wrapper });
  await waitFor(() => expect(mockIntegrityCheck).toHaveBeenCalledTimes(1));
  unmount();
  await act(async () => check.resolve({ status: "failed" }));
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

test.each([
  "foreground",
  "playback",
])("replaces mounted content with AUTH_019 after a %s failure", async (trigger) => {
  const onUnmount = jest.fn();
  const view = render(
    <SynamediaAuthGate>
      <PlaybackHarness onUnmount={onUnmount} />
    </SynamediaAuthGate>,
    { wrapper },
  );
  await waitFor(() => expect(view.getByTestId("play")).toBeTruthy());
  act(() => showErrorModal("NET_003"));
  mockIntegrityCheck.mockResolvedValue({ status: "failed" });
  if (trigger === "foreground") {
    await foreground();
  } else {
    await act(async () => fireEvent.press(view.getByTestId("play")));
  }
  await waitFor(() =>
    expect(view.getByText("Device Not Authorised")).toBeTruthy(),
  );
  expect(view.getByText("AUTH_019")).toBeTruthy();
  expect(view.queryByText("App content")).toBeNull();
  expect(view.queryByTestId("error-action-acknowledge")).toBeNull();
  expect(onUnmount).toHaveBeenCalledTimes(1);
  expect(errorModalStore.getState().code).toBeNull();
  expect(mockCreateSession).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
});
