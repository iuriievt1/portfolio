import {
  ActionScreenEventType,
  Auth,
  DeviceIntegrity,
  DevicePairingPollStatus,
  EventBus,
  EventType,
  SYNAMEDIA_TOKENS_STORAGE_KEY,
  SynamediaGoApiError,
} from "@bfbs/common-sdk";
import { PortalProvider } from "@gorhom/portal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import type { ReactNode } from "react";
import { Text } from "react-native";

import {
  consumeSignInRequest,
  requestSignIn,
  SynamediaAuthGate,
  useSynamediaAuthGate,
} from "@/features/auth";
import { mobileStorage } from "@/infra/common-sdk/utils/mobile-storage";
import {
  dismissErrorModal,
  ErrorModalHost,
  errorModalStore,
} from "@/infra/error";

const mockReportError = jest.fn();

jest.mock("@/infra/error", () => ({
  ...jest.requireActual("@/infra/error"),
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

const queryClients = new Set<QueryClient>();

/** The gate renders under the app's provider; each mount gets its own client. */
function createTestQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: 0, retry: false },
      queries: { gcTime: 0, retry: false },
    },
  });
  queryClients.add(queryClient);

  return queryClient;
}

function createWrapper(queryClient = createTestQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  for (const queryClient of queryClients) {
    queryClient.clear();
  }
  queryClients.clear();
});

jest.mock("@bfbs/common-sdk", () => ({
  DeviceIntegrity: { check: jest.fn(async () => ({ status: "passed" })) },
  DeviceIntegrityStatus: {
    FAILED: "failed",
    PASSED: "passed",
    INCONCLUSIVE: "inconclusive",
  },
  ActionScreenEventType: {
    DISMISSED: "DISMISSED",
    LOADED: "LOADED",
  },
  EventBus: { produce: jest.fn() },
  EventType: { ACTION_SCREEN_CHANGE: "ACTION_SCREEN_CHANGE" },
  Auth: {
    bootstrapSession: jest.fn(),
    getDevicePairingCode: jest.fn(),
    pollDevicePairingCode: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
  DEFAULT_SYNAMEDIA_SCOPE: "go:client:playback",
  DevicePairingPollStatus: {
    AUTHENTICATED: "AUTHENTICATED",
    DENIED: "DENIED",
    EXPIRED: "EXPIRED",
    PENDING: "PENDING",
    SLOW_DOWN: "SLOW_DOWN",
  },
  SYNAMEDIA_CLIENT_STATE_STORAGE_KEY: "bfbs.synamedia",
  SYNAMEDIA_TOKENS_STORAGE_KEY: "bfbs.tokens",
  SynamediaGoApiError: class MappedApiError extends Error {
    readonly code: string | undefined;

    constructor({ code }: { code?: string }) {
      super(`Synamedia Go request failed: ${code ?? "no code"}`);

      this.code = code;
    }
  },
  // Removal cases live in src/features/auth/hooks/__tests__.
  isDeviceNotRegisteredError: () => false,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 47 }),
}));

jest.mock("expo-web-browser", () => ({
  dismissBrowser: jest.fn(() => Promise.resolve({ type: "dismiss" })),
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: "opened" })),
  WebBrowserResultType: {
    CANCEL: "cancel",
  },
}));

jest.mock("@/features/auth/utils/device-quota", () => ({
  isDeviceQuotaReached: () => Promise.resolve(false),
}));

jest.mock("@/features/analytics/logon-analytics", () => ({
  trackSignIn: jest.fn(),
  trackSignOut: jest.fn(),
}));

jest.mock("@/features/analytics/app-analytics", () => ({
  trackPostLoginAppStart: jest.fn(),
}));

jest.mock("@/features/analytics/screens/route-screen-change-tracker", () => ({
  RouteScreenChangeTracker: () => null,
}));

jest.mock("@/infra/common-sdk/utils/mobile-storage", () => ({
  mobileStorage: {
    clear: jest.fn(),
    getItem: jest.fn(),
    key: jest.fn(),
    length: 0,
    removeItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockAuth = Auth as jest.Mocked<typeof Auth>;
const mockMobileStorage = mobileStorage as jest.Mocked<typeof mobileStorage>;
const mockWebBrowser = WebBrowser as jest.Mocked<typeof WebBrowser>;

function apiError(code: string) {
  return new SynamediaGoApiError({
    code,
    status: 400,
    statusText: "Bad Request",
  });
}

function mockPairingCode() {
  mockAuth.getDevicePairingCode.mockResolvedValue({
    deviceCode: "device-code",
    expiresInSeconds: 60,
    intervalSeconds: 1,
    userCode: "USER-CODE",
    verificationUri: "https://login.example.com",
    verificationUriComplete: "https://login.example.com/complete",
  });
}

describe("useSynamediaAuthGate", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-01T09:00:00.000Z"));
    jest.clearAllMocks();
    consumeSignInRequest();
    dismissErrorModal();
    mockMobileStorage.getItem.mockReturnValue(null);
    mockAuth.bootstrapSession.mockResolvedValue(undefined);
    mockAuth.signOut.mockResolvedValue(undefined);
    mockPairingCode();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("reuses stored tokens and bootstraps without opening sign-in", async () => {
    mockMobileStorage.getItem.mockImplementation((key) =>
      key === SYNAMEDIA_TOKENS_STORAGE_KEY
        ? JSON.stringify({
            accessToken: "access-token",
            expiresInSeconds: 3600,
            tokenType: "Bearer",
          })
        : null,
    );

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    expect(mockAuth.bootstrapSession).toHaveBeenCalledTimes(1);
    expect(mockWebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  test("preserves stored tokens when bootstrap fails temporarily and retries it", async () => {
    mockMobileStorage.getItem.mockImplementation((key) =>
      key === SYNAMEDIA_TOKENS_STORAGE_KEY
        ? JSON.stringify({
            accessToken: "access-token",
            expiresInSeconds: 3600,
            refreshToken: "refresh-token",
            tokenType: "Bearer",
          })
        : null,
    );
    mockAuth.bootstrapSession
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("bootstrap-error");
    });

    expect(mockAuth.signOut).not.toHaveBeenCalled();
    expect(mockReportError).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.retryBootstrap();
    });

    expect(result.current.state.status).toBe("ready");
    expect(mockAuth.bootstrapSession).toHaveBeenCalledTimes(2);
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  test("does not report a timeout while preserving the stored session", async () => {
    mockMobileStorage.getItem.mockImplementation((key) =>
      key === SYNAMEDIA_TOKENS_STORAGE_KEY
        ? JSON.stringify({
            accessToken: "access-token",
            expiresInSeconds: 3600,
            refreshToken: "refresh-token",
            tokenType: "Bearer",
          })
        : null,
    );
    mockAuth.bootstrapSession.mockRejectedValue(new Error("Request timed out"));

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("bootstrap-error");
    });

    expect(mockAuth.signOut).not.toHaveBeenCalled();
    expect(mockReportError).not.toHaveBeenCalled();
  });

  test.each([
    "AUTH_006",
    "AUTH_007",
  ])("clears a stored session when bootstrap returns terminal %s", async (errorCode) => {
    mockMobileStorage.getItem.mockImplementation((key) =>
      key === SYNAMEDIA_TOKENS_STORAGE_KEY
        ? JSON.stringify({
            accessToken: "access-token",
            expiresInSeconds: 3600,
            refreshToken: "refresh-token",
            tokenType: "Bearer",
          })
        : null,
    );
    mockAuth.bootstrapSession.mockRejectedValue(apiError(errorCode));

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("signed-out");
    });

    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });

  test("does not reuse stored tokens when a sign-in was already asked for", async () => {
    mockMobileStorage.getItem.mockImplementation((key) =>
      key === SYNAMEDIA_TOKENS_STORAGE_KEY
        ? JSON.stringify({
            accessToken: "access-token",
            expiresInSeconds: 3600,
            tokenType: "Bearer",
          })
        : null,
    );
    requestSignIn();

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("signed-out");
    });

    expect(mockAuth.bootstrapSession).not.toHaveBeenCalled();
  });

  test("starts device pairing sign-in and bootstraps after authentication", async () => {
    mockAuth.pollDevicePairingCode.mockResolvedValue({
      session: {
        tokens: {
          accessToken: "access-token",
          expiresInSeconds: 3600,
          tokenType: "Bearer",
        },
      },
      status: DevicePairingPollStatus.AUTHENTICATED,
    });

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("signed-out");
    });

    await act(async () => {
      await result.current.startSignIn();
    });

    expect(mockWebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "https://login.example.com/complete",
      expect.any(Object),
    );

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    expect(mockAuth.pollDevicePairingCode).toHaveBeenCalledWith({
      deviceCode: "device-code",
    });
    expect(mockAuth.bootstrapSession).toHaveBeenCalledTimes(1);
    expect(DeviceIntegrity.check).toHaveBeenCalledTimes(1);
  });

  test("waits for the sign-in browser to return before polling", async () => {
    let resolveBrowser:
      | ((result: { type: WebBrowser.WebBrowserResultType.CANCEL }) => void)
      | undefined;

    mockWebBrowser.openBrowserAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBrowser = resolve;
      }),
    );
    mockAuth.pollDevicePairingCode.mockResolvedValue({
      status: DevicePairingPollStatus.PENDING,
    });

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("signed-out");
    });

    act(() => {
      void result.current.startSignIn();
    });

    await waitFor(() => {
      expect(mockWebBrowser.openBrowserAsync).toHaveBeenCalledWith(
        "https://login.example.com/complete",
        expect.any(Object),
      );
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockAuth.pollDevicePairingCode).not.toHaveBeenCalled();

    await act(async () => {
      resolveBrowser?.({ type: WebBrowser.WebBrowserResultType.CANCEL });
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockAuth.pollDevicePairingCode).toHaveBeenCalledTimes(1);
    });
  });

  test("keeps polling while pairing is pending", async () => {
    mockAuth.pollDevicePairingCode
      .mockResolvedValueOnce({
        status: DevicePairingPollStatus.PENDING,
      })
      .mockResolvedValueOnce({
        session: {
          tokens: {
            accessToken: "access-token",
            expiresInSeconds: 3600,
            tokenType: "Bearer",
          },
        },
        status: DevicePairingPollStatus.AUTHENTICATED,
      });

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("signed-out");
    });

    await act(async () => {
      await result.current.startSignIn();
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockAuth.pollDevicePairingCode).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
  });

  test("slows down polling when requested", async () => {
    mockAuth.pollDevicePairingCode
      .mockResolvedValueOnce({
        intervalSeconds: 5,
        status: DevicePairingPollStatus.SLOW_DOWN,
      })
      .mockResolvedValueOnce({
        session: {
          tokens: {
            accessToken: "access-token",
            expiresInSeconds: 3600,
            tokenType: "Bearer",
          },
        },
        status: DevicePairingPollStatus.AUTHENTICATED,
      });

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("signed-out");
    });

    await act(async () => {
      await result.current.startSignIn();
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockAuth.pollDevicePairingCode).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockAuth.pollDevicePairingCode).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
  });

  test("clears the sign-in error when the reader tries again", async () => {
    mockAuth.signIn
      .mockRejectedValueOnce(apiError("AUTH_002"))
      .mockResolvedValueOnce({
        tokens: {
          accessToken: "access-token",
          expiresInSeconds: 3600,
          tokenType: "Bearer",
        },
      });

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("signed-out");
    });

    act(() => {
      result.current.signIn({ password: "wrong", username: "user-1" });
    });

    await waitFor(() => {
      expect(result.current.signInErrorCode).toBe("AUTH_002");
    });

    act(() => {
      result.current.signIn({ password: "secret", username: "user-1" });
    });

    await waitFor(() => {
      expect(result.current.signInErrorCode).toBeNull();
      expect(result.current.state.status).toBe("ready");
    });
  });

  test("stops polling when sign-in is denied", async () => {
    mockAuth.pollDevicePairingCode.mockResolvedValue({
      errorDescription: "Denied by user",
      status: DevicePairingPollStatus.DENIED,
    });

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("signed-out");
    });

    await act(async () => {
      await result.current.startSignIn();
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("denied");
    });

    expect(result.current.state.errorMessage).toBe("Denied by user");
    expect(mockAuth.bootstrapSession).not.toHaveBeenCalled();
  });

  test("expires pairing when the session lifetime elapses", async () => {
    mockAuth.getDevicePairingCode.mockResolvedValue({
      deviceCode: "device-code",
      expiresInSeconds: 1,
      intervalSeconds: 2,
      userCode: "USER-CODE",
      verificationUri: "https://login.example.com",
      verificationUriComplete: "https://login.example.com/complete",
    });

    const { result } = renderHook(() => useSynamediaAuthGate(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("signed-out");
    });

    await act(async () => {
      await result.current.startSignIn();
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("expired");
    });

    expect(mockAuth.pollDevicePairingCode).not.toHaveBeenCalled();
  });
});

describe("<SynamediaAuthGate />", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    consumeSignInRequest();
    dismissErrorModal();
    mockMobileStorage.getItem.mockReturnValue(null);
    mockAuth.bootstrapSession.mockResolvedValue(undefined);
    mockAuth.signOut.mockResolvedValue(undefined);
    mockPairingCode();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders the app and no disclaimer once the session is ready", async () => {
    mockMobileStorage.getItem.mockImplementation((key) =>
      key === SYNAMEDIA_TOKENS_STORAGE_KEY
        ? JSON.stringify({
            accessToken: "access-token",
            expiresInSeconds: 3600,
            tokenType: "Bearer",
          })
        : null,
    );

    const { getByText, queryByTestId } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      getByText("Home");
    });

    expect(queryByTestId("sign-in-disclaimer")).toBeNull();
  });

  test("shows the disclaimer while signed out, then the sign-in form", async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    expect(EventBus.produce).toHaveBeenCalledWith({
      type: EventType.ACTION_SCREEN_CHANGE,
      data: {
        eventType: ActionScreenEventType.LOADED,
        screenId: "sign-in",
        screenName: "Sign In",
      },
    });

    getByText("Before you sign in");
    expect(queryByTestId("sign-in-screen")).toBeNull();

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));

    getByTestId("sign-in-screen");
    getByText("Sign In");
    const signInLoadedEvents = jest
      .mocked(EventBus.produce)
      .mock.calls.map(([event]) => event)
      .filter(
        (event) =>
          event.type === EventType.ACTION_SCREEN_CHANGE &&
          event.data.eventType === ActionScreenEventType.LOADED &&
          event.data.screenId === "sign-in",
      );
    expect(signInLoadedEvents).toHaveLength(1);
    expect(mockWebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  test("signs in with the typed credentials and bootstraps the session", async () => {
    mockAuth.signIn.mockResolvedValue({
      tokens: {
        accessToken: "access-token",
        expiresInSeconds: 3600,
        tokenType: "Bearer",
      },
    });

    const { getByTestId, getByText } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "secret");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    expect(mockAuth.signIn).toHaveBeenCalledWith({
      password: "secret",
      username: "user-1",
    });
    expect(mockAuth.bootstrapSession).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      getByText("Home");
    });
  });

  test("keeps a signed-in session when setup fails, then retries setup", async () => {
    mockAuth.signIn.mockResolvedValue({
      tokens: {
        accessToken: "access-token",
        expiresInSeconds: 3600,
        tokenType: "Bearer",
      },
    });
    mockAuth.bootstrapSession
      .mockRejectedValueOnce(new Error("Household registration failed"))
      .mockResolvedValueOnce(undefined);

    const { getByTestId, getByText } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "secret");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    await waitFor(() => {
      getByText("We couldn't prepare your session. Please try again");
    });
    expect(errorModalStore.getState().code).toBeNull();
    expect(mockAuth.signOut).not.toHaveBeenCalled();
    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Household registration failed" }),
      { tags: { area: "auth", operation: "bootstrap_session" } },
    );

    await act(async () => {
      fireEvent.press(getByTestId("synamedia-sign-in-button"));
    });

    expect(mockAuth.signIn).toHaveBeenCalledTimes(1);
    expect(mockAuth.bootstrapSession).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      getByText("Home");
    });
  });

  test("lets the reader leave a persistent bootstrap failure", async () => {
    mockMobileStorage.getItem.mockImplementation((key) =>
      key === SYNAMEDIA_TOKENS_STORAGE_KEY
        ? JSON.stringify({
            accessToken: "access-token",
            expiresInSeconds: 3600,
            refreshToken: "refresh-token",
            tokenType: "Bearer",
          })
        : null,
    );
    mockAuth.bootstrapSession.mockRejectedValue(
      new Error("Household registration failed"),
    );
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["viewer"], { id: "viewer-1" });

    const { getByTestId, getByText } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      getByText("We couldn't prepare your session. Please try again");
    });

    fireEvent.press(getByTestId("synamedia-bootstrap-sign-out"));

    await waitFor(() => {
      getByTestId("sign-in-disclaimer-continue");
    });

    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    expect(mockAuth.bootstrapSession).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(["viewer"])).toBeUndefined();
  });

  test("ignores Continue while sign out is underway", async () => {
    let finishSignOut: (() => void) | undefined;
    mockMobileStorage.getItem.mockImplementation((key) =>
      key === SYNAMEDIA_TOKENS_STORAGE_KEY
        ? JSON.stringify({
            accessToken: "access-token",
            expiresInSeconds: 3600,
            refreshToken: "refresh-token",
            tokenType: "Bearer",
          })
        : null,
    );
    mockAuth.bootstrapSession.mockRejectedValue(
      new Error("Household registration failed"),
    );
    mockAuth.signOut.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSignOut = resolve;
      }),
    );

    const { getByTestId, getByText } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      getByText("We couldn't prepare your session. Please try again");
    });

    fireEvent.press(getByTestId("synamedia-bootstrap-sign-out"));

    await waitFor(() => {
      expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByTestId("synamedia-sign-in-button"));

    expect(mockAuth.bootstrapSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishSignOut?.();
    });

    await waitFor(() => {
      getByTestId("sign-in-disclaimer-continue");
    });
  });

  test("shows Continue as the yellow primary bootstrap action", async () => {
    mockMobileStorage.getItem.mockImplementation((key) =>
      key === SYNAMEDIA_TOKENS_STORAGE_KEY
        ? JSON.stringify({
            accessToken: "access-token",
            expiresInSeconds: 3600,
            refreshToken: "refresh-token",
            tokenType: "Bearer",
          })
        : null,
    );
    mockAuth.bootstrapSession.mockRejectedValue(
      new Error("Household registration failed"),
    );

    const { getByTestId, getByText } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      getByText("We couldn't prepare your session. Please try again");
    });

    expect(getByTestId("synamedia-sign-in-button").props.className).toContain(
      "bg-golden-yellow",
    );
    expect(getByText("Continue").props.className).toContain(
      "text-dark-slate-blue",
    );
    expect(
      getByTestId("synamedia-bootstrap-sign-out").props.className,
    ).toContain("bg-transparent-white-10");
    expect(getByText("Sign out").props.className).toContain("text-white");
  });

  test("keeps the inline message while the reader edits their input", async () => {
    mockAuth.signIn.mockRejectedValue(apiError("AUTH_002"));

    const { getByTestId, getByText } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "wrong");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    await waitFor(() => {
      getByText("Incorrect username or password");
    });

    expect(errorModalStore.getState().code).toBeNull();

    fireEvent.changeText(getByTestId("sign-in-password"), "another try");

    getByText("Incorrect username or password");
  });

  test("raises the dialog for a failure the table does not show inline", async () => {
    mockAuth.signIn.mockRejectedValue(apiError("AUTH_003"));

    const { getByTestId, queryByTestId } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "secret");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    await waitFor(() => {
      expect(errorModalStore.getState().code).toBe("AUTH_003");
    });

    getByTestId("sign-in-screen");
    expect(queryByTestId("sign-in-error")).toBeNull();
  });

  test("shows the connection dialog when the request never arrives", async () => {
    mockAuth.signIn.mockRejectedValue(new TypeError("Network request failed"));

    const { getByTestId, queryByTestId } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "secret");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    await waitFor(() => {
      expect(errorModalStore.getState().code).toBe("NET_001");
    });

    getByTestId("sign-in-screen");
    expect(queryByTestId("sign-in-error")).toBeNull();
  });

  test("raises the dialog again when the same failure repeats", async () => {
    mockAuth.signIn.mockRejectedValue(apiError("AUTH_003"));

    const { getByTestId } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "secret");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    await waitFor(() => {
      expect(errorModalStore.getState().code).toBe("AUTH_003");
    });

    dismissErrorModal();

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    await waitFor(() => {
      expect(errorModalStore.getState().code).toBe("AUTH_003");
    });

    expect(mockAuth.signIn).toHaveBeenCalledTimes(2);
  });

  test("shows the dialog above the form, with its code", async () => {
    mockAuth.signIn.mockRejectedValue(apiError("AUTH_003"));

    const { getByTestId, getByText } = render(
      <PortalProvider>
        <SynamediaAuthGate>
          <Text>Home</Text>
        </SynamediaAuthGate>
        <ErrorModalHost onSignIn={requestSignIn} />
      </PortalProvider>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "secret");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    await waitFor(() => {
      getByTestId("error-modal");
    });

    getByText("Account Expired");
    getByText("Error code: AUTH_003");
    getByTestId("error-action-acknowledge");
  });

  test("counts one attempt when Continue is pressed twice in a frame", async () => {
    mockAuth.signIn.mockRejectedValue(apiError("AUTH_002"));

    const { getByTestId } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "wrong");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    expect(mockAuth.signIn).toHaveBeenCalledTimes(1);
  });

  test("takes over the screen for a failure that blocks the app", async () => {
    mockAuth.signIn.mockRejectedValue(apiError("AUTH_019"));

    const { getByTestId, getByText, queryByTestId } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "secret");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    await waitFor(() => {
      getByTestId("error-full-screen");
    });

    getByText("Device Not Authorised");
    expect(queryByTestId("sign-in-screen")).toBeNull();
    expect(queryByTestId("error-action-cancel")).toBeNull();
    expect(queryByTestId("error-action-acknowledge")).toBeNull();
    expect(errorModalStore.getState().code).toBeNull();
  });

  test("returns to the form when an error action asks for sign-in", async () => {
    mockAuth.signIn.mockResolvedValue({
      tokens: {
        accessToken: "access-token",
        expiresInSeconds: 3600,
        tokenType: "Bearer",
      },
    });

    const { getByTestId, getByText } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "secret");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    await waitFor(() => {
      getByText("Home");
    });

    await act(async () => {
      requestSignIn();
    });

    await waitFor(() => {
      getByTestId("sign-in-screen");
    });

    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });

  test("signs out once when concurrent failures request sign-in", async () => {
    let finishSignOut: (() => void) | undefined;
    mockAuth.signIn.mockResolvedValue({
      tokens: {
        accessToken: "access-token",
        expiresInSeconds: 3600,
        tokenType: "Bearer",
      },
    });
    mockAuth.signOut.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSignOut = resolve;
      }),
    );

    const { getByTestId, getByText } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "secret");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    await waitFor(() => {
      getByText("Home");
    });

    act(() => {
      requestSignIn();
    });

    await waitFor(() => {
      expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    });

    act(() => {
      requestSignIn();
    });

    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishSignOut?.();
    });

    await waitFor(() => {
      getByTestId("sign-in-screen");
    });
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });

  test("keeps the reader on the form when the request comes from the form", async () => {
    const { getByTestId } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));

    await act(async () => {
      requestSignIn();
    });

    getByTestId("sign-in-screen");
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  test("keeps the reader on the form when the credentials are rejected", async () => {
    mockAuth.signIn.mockRejectedValue(apiError("AUTH_002"));

    const { getByTestId, getByText } = render(
      <SynamediaAuthGate>
        <Text>Home</Text>
      </SynamediaAuthGate>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(getByTestId("sign-in-disclaimer-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));
    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "wrong");

    await act(async () => {
      fireEvent.press(getByTestId("sign-in-continue"));
    });

    getByTestId("sign-in-screen");
    await waitFor(() => {
      getByText("Incorrect username or password");
    });
    expect(mockAuth.bootstrapSession).not.toHaveBeenCalled();
  });
});
