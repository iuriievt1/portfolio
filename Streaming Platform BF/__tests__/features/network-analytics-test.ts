import { EventType, NetworkState, NetworkType } from "@bfbs/common-sdk";
import {
  stopNetworkChanges,
  trackNetworkChanges,
} from "@/features/analytics/network-analytics";
import type { NetworkStateSnapshot } from "@/utils/expo-native-modules";

const DEVICE_IP = "192.168.1.20";
const wifi = { isConnected: true, isInternetReachable: true, type: "WIFI" };

const mockTrack = jest.fn();
const mockRemove = jest.fn();
let sendNetworkState: (snapshot: NetworkStateSnapshot) => void;

const mockNetwork = {
  addNetworkStateListener: jest.fn(
    (listener: (snapshot: NetworkStateSnapshot) => void) => {
      sendNetworkState = listener;
      return { remove: mockRemove };
    },
  ),
  getIpAddressAsync: jest.fn(async () => DEVICE_IP),
  getNetworkStateAsync: jest.fn(
    async (): Promise<NetworkStateSnapshot> => wifi,
  ),
};

jest.mock("@/features/analytics/analytics-manager", () => ({
  analyticsManager: { track: (event: unknown) => mockTrack(event) },
}));

jest.mock("@/infra/error/utils/report-error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/utils/expo-native-modules", () => ({
  getExpoNetworkModule: () => mockNetwork,
}));

// Lets the queued network events finish.
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function networkChange(
  state: NetworkState,
  type: NetworkType,
  ipAddress = DEVICE_IP,
) {
  return { type: EventType.NETWORK_CHANGE, data: { ipAddress, state, type } };
}

// The events sent, in order.
function sentEvents() {
  return mockTrack.mock.calls.map(([event]) => event);
}

describe("network analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetwork.getIpAddressAsync.mockResolvedValue(DEVICE_IP);
    mockNetwork.getNetworkStateAsync.mockResolvedValue(wifi);
  });

  afterEach(() => {
    stopNetworkChanges();
  });

  test("sends the first network state on start", async () => {
    trackNetworkChanges();
    await flush();

    expect(sentEvents()).toEqual([
      networkChange(NetworkState.CONNECT, NetworkType.WIFI),
    ]);
  });

  test.each([
    // NetworkType.CELLUAR is the SDK's spelling; its value is "CELLULAR".
    [
      "mobile data",
      "CELLULAR",
      true,
      NetworkState.CONNECT,
      NetworkType.CELLUAR,
    ],
    ["ethernet", "ETHERNET", true, NetworkState.CONNECT, NetworkType.WIRED],
    [
      "Wi-Fi with no internet",
      "WIFI",
      false,
      NetworkState.LOCAL_ONLY,
      NetworkType.WIFI,
    ],
  ] as const)("maps %s", async (_name, type, isInternetReachable, state, expectedType) => {
    mockNetwork.getNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable,
      type,
    });

    trackNetworkChanges();
    await flush();

    expect(sentEvents()).toEqual([networkChange(state, expectedType)]);
  });

  test("sends no IP when the device has none", async () => {
    mockNetwork.getIpAddressAsync.mockResolvedValue("0.0.0.0");

    trackNetworkChanges();
    await flush();

    expect(sentEvents()).toEqual([
      networkChange(NetworkState.CONNECT, NetworkType.WIFI, ""),
    ]);
  });

  test.each([
    "VPN",
    "UNKNOWN",
  ])("skips %s, which has no SDK value", async (type) => {
    mockNetwork.getNetworkStateAsync.mockResolvedValue({ ...wifi, type });

    trackNetworkChanges();
    await flush();

    expect(sentEvents()).toEqual([]);
  });

  test("sends only real changes", async () => {
    trackNetworkChanges();
    await flush();

    sendNetworkState(wifi);
    sendNetworkState({ ...wifi, type: "CELLULAR" });
    await flush();

    expect(sentEvents()).toEqual([
      networkChange(NetworkState.CONNECT, NetworkType.WIFI),
      networkChange(NetworkState.DISCONNECT, NetworkType.WIFI, ""),
      networkChange(NetworkState.CONNECT, NetworkType.CELLUAR),
    ]);
  });

  test("sends the first state before a change that comes during the first read", async () => {
    let finishFirstRead!: (snapshot: NetworkStateSnapshot) => void;
    mockNetwork.getNetworkStateAsync.mockReturnValue(
      new Promise<NetworkStateSnapshot>((resolve) => {
        finishFirstRead = resolve;
      }),
    );

    trackNetworkChanges();
    await flush();
    sendNetworkState({ ...wifi, type: "CELLULAR" });
    finishFirstRead(wifi);
    await flush();

    expect(sentEvents()).toEqual([
      networkChange(NetworkState.CONNECT, NetworkType.WIFI),
      networkChange(NetworkState.DISCONNECT, NetworkType.WIFI, ""),
      networkChange(NetworkState.CONNECT, NetworkType.CELLUAR),
    ]);
  });

  test("on disconnect, sends the network that was lost, with no IP", async () => {
    trackNetworkChanges();
    await flush();

    sendNetworkState({
      isConnected: false,
      isInternetReachable: false,
      type: "NONE",
    });
    await flush();

    expect(sentEvents()).toEqual([
      networkChange(NetworkState.CONNECT, NetworkType.WIFI),
      networkChange(NetworkState.DISCONNECT, NetworkType.WIFI, ""),
    ]);
    expect(mockNetwork.getIpAddressAsync).toHaveBeenCalledTimes(1);
  });

  test("stopNetworkChanges removes the listener and forgets the last state", async () => {
    trackNetworkChanges();
    await flush();
    stopNetworkChanges();

    expect(mockRemove).toHaveBeenCalledTimes(1);

    trackNetworkChanges();
    await flush();

    expect(sentEvents()).toEqual([
      networkChange(NetworkState.CONNECT, NetworkType.WIFI),
      networkChange(NetworkState.CONNECT, NetworkType.WIFI),
    ]);
  });
});
