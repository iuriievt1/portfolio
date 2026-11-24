const mockRequireOptionalNativeModule = jest.fn();
const mockNetworkModule = jest.fn();

jest.mock("expo-modules-core", () => ({
  requireOptionalNativeModule: () => mockRequireOptionalNativeModule(),
}));

jest.mock("expo-network", () => mockNetworkModule());

import { getExpoNetworkModule } from "@/utils/expo-native-modules";

describe("getExpoNetworkModule", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("returns the module when the binary carries it", () => {
    const addNetworkStateListener = jest.fn();
    const getNetworkStateAsync = jest.fn();

    mockRequireOptionalNativeModule.mockReturnValue({});
    mockNetworkModule.mockReturnValue({
      addNetworkStateListener,
      getNetworkStateAsync,
    });

    expect(getExpoNetworkModule().getNetworkStateAsync).toBe(
      getNetworkStateAsync,
    );
  });

  test("reports a working connection when the native module is missing", async () => {
    mockRequireOptionalNativeModule.mockReturnValue(null);

    const Network = getExpoNetworkModule();

    await expect(Network.getNetworkStateAsync()).resolves.toEqual({
      isConnected: true,
      isInternetReachable: true,
    });
    expect(Network.addNetworkStateListener(() => {})).toEqual({
      remove: expect.any(Function),
    });
  });

  test("reports a working connection when the module resolves to nothing", async () => {
    mockRequireOptionalNativeModule.mockReturnValue({});
    mockNetworkModule.mockReturnValue(undefined);

    await expect(
      getExpoNetworkModule().getNetworkStateAsync(),
    ).resolves.toEqual({
      isConnected: true,
      isInternetReachable: true,
    });
  });
});
