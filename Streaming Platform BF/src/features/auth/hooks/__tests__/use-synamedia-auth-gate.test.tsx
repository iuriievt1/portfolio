const mockBootstrapSession = jest.fn<Promise<void>, []>();
const mockSignIn = jest.fn<Promise<void>, []>();
const mockSignOut = jest.fn<
  Promise<void>,
  [options?: { forgetDevice?: boolean }]
>();
const mockIsDeviceQuotaReached = jest.fn<Promise<boolean>, []>();

jest.mock("@bfbs/common-sdk", () => ({
  ...jest.requireActual("../../../../../__mocks__/common-sdk-enums"),
  DeviceIntegrity: { check: jest.fn(async () => ({ status: "passed" })) },
  DeviceIntegrityStatus: {
    FAILED: "failed",
    PASSED: "passed",
    INCONCLUSIVE: "inconclusive",
  },
  EventBus: { produce: jest.fn() },
  Auth: {
    bootstrapSession: () => mockBootstrapSession(),
    signIn: () => mockSignIn(),
    signOut: (options?: { forgetDevice?: boolean }) => mockSignOut(options),
  },
  DevicePairingPollStatus: {
    AUTHENTICATED: "authenticated",
    DENIED: "denied",
    EXPIRED: "expired",
    PENDING: "pending",
    SLOW_DOWN: "slow_down",
  },
}));

jest.mock("../../utils/synamedia-storage", () => ({
  hasStoredSynamediaAuthSession: () => true,
}));

jest.mock("../../utils/pending-device-registration", () => ({
  clearPendingDeviceRegistration: jest.fn(),
  hasPendingDeviceRegistration: jest.fn(() => false),
  setPendingDeviceRegistration: jest.fn(),
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

jest.mock("@/infra/error", () => ({
  ...jest.requireActual("@/infra/error"),
  reportError: jest.fn(),
}));

import { SynamediaGoApiError } from "@bfbs/common-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { type PropsWithChildren, type ReactNode, useEffect } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { dismissErrorModal, errorModalStore, reportError } from "@/infra/error";
import { useAuthSession } from "../../auth-session-context";
import { SynamediaAuthGate } from "../../components/synamedia-auth-gate";
import {
  clearDeviceRemoved,
  reportDeviceRemoved,
  useIsDeviceRemoved,
} from "../../device-removed-store";
import { requestSignIn } from "../../sign-in-request-store";
import {
  clearPendingDeviceRegistration,
  hasPendingDeviceRegistration,
  setPendingDeviceRegistration,
} from "../../utils/pending-device-registration";
import { useSynamediaAuthGate } from "../use-synamedia-auth-gate";

const initialMetrics = {
  frame: { height: 844, width: 390, x: 0, y: 0 },
  insets: { bottom: 34, left: 0, right: 0, top: 47 },
};

const queryClients = new Set<QueryClient>();

function renderAuthGateHook() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: 0, retry: false },
      queries: { gcTime: 0, retry: false },
    },
  });
  queryClients.add(queryClient);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    ...renderHook(() => useSynamediaAuthGate(), { wrapper }),
    clearQueryClient: jest.spyOn(queryClient, "clear"),
  };
}

afterEach(() => {
  for (const queryClient of queryClients) {
    queryClient.clear();
  }
  queryClients.clear();
});

function SignOutHarness() {
  const { signOut } = useAuthSession();

  return <Pressable onPress={() => void signOut()} testID="request-logout" />;
}

describe("useSynamediaAuthGate logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBootstrapSession.mockResolvedValue();
    mockSignOut.mockResolvedValue();
  });

  it("deduplicates logout, clears cached account data, and removes app content", async () => {
    let resolveSignOut: (() => void) | undefined;
    mockSignOut.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );
    const { clearQueryClient, result } = renderAuthGateHook();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    let firstRequest: Promise<void> | undefined;
    let secondRequest: Promise<void> | undefined;
    act(() => {
      firstRequest = result.current.signOut();
      secondRequest = result.current.signOut();
    });

    expect(firstRequest).toBe(secondRequest);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    // Normal logout keeps the device registered.
    expect(mockSignOut).toHaveBeenCalledWith(undefined);

    await act(async () => {
      resolveSignOut?.();
      await firstRequest;
    });

    expect(clearQueryClient).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("signed-out");
  });

  it("keeps authenticated content and cache available when logout fails", async () => {
    const failure = new Error("logout failed");
    mockSignOut.mockRejectedValueOnce(failure);
    const { clearQueryClient, result } = renderAuthGateHook();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    await act(async () => {
      await expect(result.current.signOut()).rejects.toBe(failure);
    });

    expect(clearQueryClient).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("ready");
  });

  it("shows the sign-in form immediately after an explicit logout", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: 0, retry: false } },
    });
    queryClients.add(queryClient);
    const { getByTestId, queryByTestId, unmount } = render(
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider initialMetrics={initialMetrics}>
          <SynamediaAuthGate>
            <SignOutHarness />
          </SynamediaAuthGate>
        </SafeAreaProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(getByTestId("request-logout")).toBeTruthy());

    fireEvent.press(getByTestId("request-logout"));

    await waitFor(() => expect(getByTestId("sign-in-screen")).toBeTruthy());
    expect(queryByTestId("sign-in-disclaimer")).toBeNull();
    unmount();
    queryClient.clear();
  });
});

function createRemovalError() {
  return new SynamediaGoApiError({
    code: "AUTH_020",
    reason: "device_not_registered",
    status: 403,
    statusText: "Forbidden",
  });
}

const playerUnmounted = jest.fn();

// Stands in for app screens and the player inside the gate.
function PlayerHarness() {
  useEffect(() => {
    return () => playerUnmounted();
  }, []);

  return <View testID="player" />;
}

function renderAuthGate(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  queryClients.add(queryClient);
  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <SynamediaAuthGate>{children}</SynamediaAuthGate>
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

describe("useSynamediaAuthGate device removal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDeviceRemoved();
    mockBootstrapSession.mockResolvedValue();
    mockSignOut.mockResolvedValue();
  });

  it("shows AUTH_020 and forgets the device when startup finds it removed", async () => {
    mockBootstrapSession.mockRejectedValueOnce(createRemovalError());
    const { clearQueryClient, result } = renderAuthGateHook();

    await waitFor(() => expect(clearQueryClient).toHaveBeenCalledTimes(1));
    expect(result.current.state.status).toBe("device-removed");
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ forgetDevice: true });
  });

  it("shares one cleanup when several calls report the removal", async () => {
    const { clearQueryClient, result } = renderAuthGateHook();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    act(() => {
      reportDeviceRemoved();
      reportDeviceRemoved();
    });
    act(() => {
      reportDeviceRemoved();
    });

    await waitFor(() => expect(clearQueryClient).toHaveBeenCalledTimes(1));
    expect(result.current.state.status).toBe("device-removed");
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("keeps AUTH_020 when a sign-in request comes after the removal", async () => {
    const { result } = renderAuthGateHook();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    act(() => reportDeviceRemoved());
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));

    act(() => requestSignIn());

    expect(result.current.state.status).toBe("device-removed");
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("keeps AUTH_020 when an earlier expiry sign-out finishes last", async () => {
    let resolveExpirySignOut: (() => void) | undefined;
    const { result } = renderAuthGateHook();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    mockSignOut.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveExpirySignOut = resolve;
        }),
    );

    act(() => requestSignIn());
    act(() => reportDeviceRemoved());
    await act(async () => resolveExpirySignOut?.());

    expect(result.current.state.status).toBe("device-removed");
    expect(mockSignOut).toHaveBeenNthCalledWith(2, { forgetDevice: true });
  });

  it("clears the removal flag when Sign In is pressed on AUTH_020", async () => {
    const { result } = renderAuthGateHook();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    act(() => reportDeviceRemoved());
    await waitFor(() =>
      expect(result.current.state.status).toBe("device-removed"),
    );

    act(() => result.current.signInAfterDeviceRemoved());

    expect(result.current.state.status).toBe("signed-out");
    expect(renderHook(() => useIsDeviceRemoved()).result.current).toBe(false);
  });

  it("replaces the app and player with AUTH_020 and only a Sign In button", async () => {
    const { getByTestId, getByText, queryByTestId } = renderAuthGate(
      <PlayerHarness />,
    );
    await waitFor(() => expect(getByTestId("player")).toBeTruthy());

    act(() => reportDeviceRemoved());

    await waitFor(() => expect(getByTestId("error-full-screen")).toBeTruthy());
    expect(queryByTestId("player")).toBeNull();
    expect(playerUnmounted).toHaveBeenCalledTimes(1);
    expect(getByText("App Requires Sign In")).toBeTruthy();
    expect(
      getByText(
        "The application is not currently authorised on this device. Please re-try signing in.",
      ),
    ).toBeTruthy();
    expect(getByTestId("error-full-screen-code")).toHaveTextContent("AUTH_020");
    expect(getByTestId("error-action-signIn")).toBeTruthy();
    expect(queryByTestId("error-action-back")).toBeNull();
  });

  it("opens the sign-in form without the disclaimer from AUTH_020", async () => {
    const { getByTestId, queryByTestId } = renderAuthGate(<PlayerHarness />);
    await waitFor(() => expect(getByTestId("player")).toBeTruthy());
    act(() => reportDeviceRemoved());
    await waitFor(() => expect(getByTestId("error-full-screen")).toBeTruthy());

    fireEvent.press(getByTestId("error-action-signIn"));

    await waitFor(() => expect(getByTestId("sign-in-screen")).toBeTruthy());
    expect(queryByTestId("sign-in-disclaimer")).toBeNull();
    expect(queryByTestId("player")).toBeNull();
  });
});

describe("useSynamediaAuthGate AUTH_021", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dismissErrorModal();
    mockBootstrapSession.mockResolvedValue();
    mockIsDeviceQuotaReached.mockResolvedValue(false);
    mockSignIn.mockResolvedValue();
    mockSignOut.mockResolvedValue();
  });

  async function renderTooManyDevices() {
    mockBootstrapSession
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("registration failed"));
    mockIsDeviceQuotaReached.mockResolvedValue(true);
    const rendered = renderAuthGateHook();
    await waitFor(() =>
      expect(rendered.result.current.state.status).toBe("ready"),
    );

    act(() =>
      rendered.result.current.signIn({ password: "secret", username: "user" }),
    );

    await waitFor(() =>
      expect(rendered.result.current.state.status).toBe("too-many-devices"),
    );
    return rendered;
  }

  it("shows AUTH_021 and keeps the tokens when a new sign-in finds the household full", async () => {
    await renderTooManyDevices();

    expect(errorModalStore.getState().code).toBe("AUTH_021");
    expect(setPendingDeviceRegistration).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("skips the quota check when a new sign-in times out", async () => {
    mockBootstrapSession
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("request timed out"));
    mockIsDeviceQuotaReached.mockResolvedValue(true);
    const { result } = renderAuthGateHook();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    act(() => result.current.signIn({ password: "secret", username: "user" }));

    await waitFor(() =>
      expect(result.current.state.status).toBe("bootstrap-error"),
    );
    expect(mockIsDeviceQuotaReached).not.toHaveBeenCalled();
  });

  it("opens the app and clears the mark when registration works after a removal", async () => {
    const { result } = await renderTooManyDevices();
    jest.mocked(clearPendingDeviceRegistration).mockClear();

    await act(async () => {
      await result.current.registerAfterRemoval();
    });

    expect(result.current.state.status).toBe("ready");
    expect(clearPendingDeviceRegistration).toHaveBeenCalledTimes(1);
  });

  it("stays on Devices when registration fails after a removal", async () => {
    const { result } = await renderTooManyDevices();
    const failure = new Error("registration failed again");
    mockBootstrapSession.mockRejectedValueOnce(failure);

    await act(async () => {
      await result.current.registerAfterRemoval();
    });

    expect(result.current.state.status).toBe("too-many-devices");
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(failure, {
      tags: { area: "auth", operation: "register_after_removal" },
    });
  });

  it("asks to sign in again when the app starts after an unfinished AUTH_021", async () => {
    jest.mocked(hasPendingDeviceRegistration).mockReturnValueOnce(true);
    const { result } = renderAuthGateHook();

    await waitFor(() => expect(result.current.state.status).toBe("signed-out"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockBootstrapSession).not.toHaveBeenCalled();
  });
});
