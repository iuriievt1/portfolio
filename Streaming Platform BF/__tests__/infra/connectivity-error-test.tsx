import { act, renderHook } from "@testing-library/react-native";

const mockAddNetworkStateListener = jest.fn();
const mockGetNetworkStateAsync = jest.fn();

jest.mock("expo-network", () => ({
  addNetworkStateListener: (listener: unknown) =>
    mockAddNetworkStateListener(listener),
  getNetworkStateAsync: () => mockGetNetworkStateAsync(),
}));

import {
  dismissErrorModal,
  errorModalStore,
  showErrorModal,
  useConnectivityError,
} from "@/infra/error";
import { isDeviceOffline } from "@/infra/error/connectivity-store";

type NetworkListener = (state: {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}) => void;

function getListener(): NetworkListener {
  return mockAddNetworkStateListener.mock.calls.at(-1)?.[0];
}

describe("useConnectivityError", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dismissErrorModal();
    mockAddNetworkStateListener.mockReturnValue({ remove: jest.fn() });
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  test("stays quiet while the device is online", async () => {
    renderHook(() => useConnectivityError());

    await act(async () => {});

    expect(errorModalStore.getState().code).toBeNull();
  });

  test("raises the offline code when the device drops the connection", async () => {
    renderHook(() => useConnectivityError());

    await act(async () => {});

    act(() => {
      getListener()({ isConnected: false, isInternetReachable: false });
    });

    expect(errorModalStore.getState().code).toBe("NET_001");
  });

  test("clears the offline dialog once the connection is back", async () => {
    renderHook(() => useConnectivityError());

    await act(async () => {});

    act(() => {
      getListener()({ isConnected: false });
    });
    act(() => {
      getListener()({ isConnected: true, isInternetReachable: true });
    });

    expect(errorModalStore.getState().code).toBeNull();
  });

  test("leaves another error on screen when the connection returns", async () => {
    renderHook(() => useConnectivityError());

    await act(async () => {});

    showErrorModal("PLAY_002");

    act(() => {
      getListener()({ isConnected: true, isInternetReachable: true });
    });

    expect(errorModalStore.getState().code).toBe("PLAY_002");
  });

  test("publishes the reading the error mappers consult", async () => {
    renderHook(() => useConnectivityError());

    await act(async () => {});

    expect(isDeviceOffline()).toBe(false);

    act(() => {
      getListener()({ isConnected: false, isInternetReachable: false });
    });

    expect(isDeviceOffline()).toBe(true);

    act(() => {
      getListener()({ isConnected: true, isInternetReachable: true });
    });

    expect(isDeviceOffline()).toBe(false);
  });

  test("raises the dialog when the device is already offline on launch", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({ isConnected: false });

    renderHook(() => useConnectivityError());

    await act(async () => {});

    expect(errorModalStore.getState().code).toBe("NET_001");
  });
});
