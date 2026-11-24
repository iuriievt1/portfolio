const mockBootstrapSession = jest.fn<Promise<void>, []>();
const mockSignIn = jest.fn<Promise<void>, []>();
const mockSignOut = jest.fn<Promise<void>, []>();
const mockGetPairingCode = jest.fn();
const mockPollPairingCode = jest.fn();
const mockHasSession = jest.fn(() => true);

jest.mock("@bfbs/common-sdk", () => ({
  ...jest.requireActual("../../../../../__mocks__/common-sdk-enums"),
  Auth: {
    bootstrapSession: () => mockBootstrapSession(),
    getDevicePairingCode: () => mockGetPairingCode(),
    pollDevicePairingCode: () => mockPollPairingCode(),
    signIn: () => mockSignIn(),
    signOut: () => mockSignOut(),
  },
  DeviceIntegrity: { check: jest.fn(async () => ({ status: "passed" })) },
  DeviceIntegrityStatus: {
    FAILED: "failed",
    INCONCLUSIVE: "inconclusive",
    PASSED: "passed",
  },
  DevicePairingPollStatus: {
    AUTHENTICATED: "authenticated",
    DENIED: "denied",
    EXPIRED: "expired",
    PENDING: "pending",
    SLOW_DOWN: "slow_down",
  },
}));

jest.mock("expo-web-browser", () => ({
  dismissBrowser: jest.fn(async () => {}),
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
}));

jest.mock("@/features/analytics/logon-analytics", () => ({
  trackSignIn: jest.fn(),
  trackSignOut: jest.fn(),
}));

jest.mock("@/features/analytics/app-analytics", () => ({
  trackPostLoginAppStart: jest.fn(),
}));

jest.mock("../../utils/synamedia-storage", () => ({
  hasStoredSynamediaAuthSession: () => mockHasSession(),
}));

jest.mock("../../utils/pending-device-registration", () => ({
  clearPendingDeviceRegistration: jest.fn(),
  hasPendingDeviceRegistration: jest.fn(() => false),
  setPendingDeviceRegistration: jest.fn(),
}));

jest.mock("../../utils/device-quota", () => ({
  isDeviceQuotaReached: jest.fn(async () => false),
}));

jest.mock("@/infra/error", () => ({
  ...jest.requireActual("@/infra/error"),
  reportError: jest.fn(),
}));

import { DevicePairingPollStatus } from "@bfbs/common-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { trackPostLoginAppStart } from "@/features/analytics/app-analytics";
import {
  trackSignIn,
  trackSignOut,
} from "@/features/analytics/logon-analytics";
import { dismissErrorModal } from "@/infra/error";
import {
  consumeSignInRequest,
  requestSignIn,
} from "../../sign-in-request-store";
import { useSynamediaAuthGate } from "../use-synamedia-auth-gate";

const credentials = { password: "secret", username: "user" };
const pairingSession = {
  deviceCode: "device-code",
  expiresInSeconds: 600,
  // Poll at once, so the tests need no fake timers.
  intervalSeconds: 0,
  userCode: "ABCD",
  verificationUri: "https://example.com/pair",
};

function renderAuthGateHook() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: 0, retry: false },
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useSynamediaAuthGate(), { wrapper });
}

async function renderSignedOut() {
  mockHasSession.mockReturnValue(false);
  const rendered = renderAuthGateHook();
  await waitFor(() =>
    expect(rendered.result.current.state.status).toBe("signed-out"),
  );
  return rendered;
}

async function renderSignedIn() {
  const rendered = renderAuthGateHook();
  await waitFor(() =>
    expect(rendered.result.current.state.status).toBe("ready"),
  );
  return rendered;
}

describe("useSynamediaAuthGate ACTION_LOGON", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consumeSignInRequest();
    dismissErrorModal();
    mockHasSession.mockReturnValue(true);
    mockBootstrapSession.mockResolvedValue();
    mockSignIn.mockResolvedValue();
    mockSignOut.mockResolvedValue();
    mockGetPairingCode.mockResolvedValue(pairingSession);
  });

  it("does not send a sign-in when a saved session is restored", async () => {
    await renderSignedIn();

    expect(trackSignIn).not.toHaveBeenCalled();
  });

  it("sends one sign-in after a password sign-in, even on a double press", async () => {
    const { result } = await renderSignedOut();

    act(() => {
      result.current.signIn(credentials);
      result.current.signIn(credentials);
    });

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(trackSignIn).toHaveBeenCalledTimes(1);
    expect(trackPostLoginAppStart).toHaveBeenCalledTimes(1);
    expect(trackSignOut).not.toHaveBeenCalled();
  });

  it("does not send a sign-in when the password sign-in fails", async () => {
    mockSignIn.mockRejectedValueOnce(new Error("wrong password"));
    const { result } = await renderSignedOut();

    act(() => result.current.signIn(credentials));

    await waitFor(() => expect(result.current.signInErrorCode).not.toBeNull());
    expect(trackSignIn).not.toHaveBeenCalled();
    expect(trackPostLoginAppStart).not.toHaveBeenCalled();
  });

  it("sends one sign-in after pairing is approved", async () => {
    mockPollPairingCode
      .mockResolvedValueOnce({ status: DevicePairingPollStatus.PENDING })
      .mockResolvedValueOnce({ status: DevicePairingPollStatus.AUTHENTICATED });
    const { result } = await renderSignedOut();

    await act(async () => {
      await result.current.startSignIn();
    });

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(mockPollPairingCode).toHaveBeenCalledTimes(2);
    expect(trackSignIn).toHaveBeenCalledTimes(1);
    expect(trackPostLoginAppStart).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["denied", DevicePairingPollStatus.DENIED],
    ["expired", DevicePairingPollStatus.EXPIRED],
  ])("does not send a sign-in when pairing is %s", async (status, pollStatus) => {
    mockPollPairingCode.mockResolvedValueOnce({ status: pollStatus });
    const { result } = await renderSignedOut();

    await act(async () => {
      await result.current.startSignIn();
    });

    await waitFor(() => expect(result.current.state.status).toBe(status));
    expect(trackSignIn).not.toHaveBeenCalled();
    expect(trackPostLoginAppStart).not.toHaveBeenCalled();
  });

  it("does not send a sign-in when pairing is approved after the user left it", async () => {
    let finishPoll: (result: { status: string }) => void = () => {};
    mockPollPairingCode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPoll = resolve;
        }),
    );
    const { result } = await renderSignedOut();
    await act(async () => {
      await result.current.startSignIn();
    });
    await waitFor(() => expect(mockPollPairingCode).toHaveBeenCalledTimes(1));

    act(() => requestSignIn());
    await waitFor(() => expect(result.current.state.status).toBe("signed-out"));
    await act(async () => {
      finishPoll({ status: DevicePairingPollStatus.AUTHENTICATED });
    });

    expect(trackSignIn).not.toHaveBeenCalled();
    expect(trackPostLoginAppStart).not.toHaveBeenCalled();
    expect(mockBootstrapSession).not.toHaveBeenCalled();
  });

  it("sends one sign-out, even when sign-out is pressed twice", async () => {
    const { result } = await renderSignedIn();

    await act(async () => {
      await Promise.all([result.current.signOut(), result.current.signOut()]);
    });

    expect(result.current.state.status).toBe("signed-out");
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(trackSignOut).toHaveBeenCalledTimes(1);
  });

  it("does not send a sign-out when sign-out fails", async () => {
    const failure = new Error("sign-out failed");
    mockSignOut.mockRejectedValueOnce(failure);
    const { result } = await renderSignedIn();

    await act(async () => {
      await expect(result.current.signOut()).rejects.toBe(failure);
    });

    expect(result.current.state.status).toBe("ready");
    expect(trackSignOut).not.toHaveBeenCalled();
  });

  it("does not send a sign-out when the app signs the user out", async () => {
    const { result } = await renderSignedIn();

    act(() => requestSignIn());

    await waitFor(() => expect(result.current.state.status).toBe("signed-out"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(trackSignOut).not.toHaveBeenCalled();
  });
});
