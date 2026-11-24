jest.mock("@bfbs/common-sdk/device-integrity/native", () => ({
  NativeDeviceIntegrityService: class NativeDeviceIntegrityService {},
}));
const mockOsVersion = jest.fn((): string | null => null);

jest.mock("expo-device", () => ({
  modelName: "Test device",
  get osVersion() {
    return mockOsVersion();
  },
}));
jest.mock("@/infra/app-version/app-version-metadata", () => ({
  getAppVersionMetadata: () => ({ version: "4.2.0" }),
}));

const mockConfigureSdk = jest.fn();
const mockPlatform = jest.fn(() => "ios");

jest.mock("react-native", () => ({
  Appearance: {
    addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
    getColorScheme: jest.fn(() => "light"),
  },
  Platform: {
    get OS() {
      return mockPlatform();
    },
    Version: 17,
  },
}));
const mockClear = jest.fn();
const mockGetFingerprint = jest.fn();
const mockReadFingerprint = jest.fn();
const mockWriteFingerprint = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  configureSdk: (options: unknown) => mockConfigureSdk(options),
  SynamediaGoClient: {},
}));

jest.mock("@/infra/common-sdk/utils/mobile-storage", () => ({
  mobileStorage: { clear: () => mockClear() },
}));

jest.mock("@/infra/common-sdk/utils/synamedia-config-fingerprint", () => ({
  getSynamediaConfigFingerprint: (value: unknown) => mockGetFingerprint(value),
  readStoredSynamediaConfigFingerprint: () => mockReadFingerprint(),
  writeStoredSynamediaConfigFingerprint: (fingerprint: string) =>
    mockWriteFingerprint(fingerprint),
}));
jest.mock("@/infra/error", () => ({ reportError: jest.fn() }));

import {
  getGoAnalyticsApplicationMetadata,
  resetSynamediaStateOnConfigChange,
} from "@/infra/common-sdk/configure-common-sdk";

const config = {
  applicationId: "app-id",
  goApiBaseUrl: "https://go.example",
  projectId: "project-id",
  scope: "scope-value",
};

describe("configureCommonSdk native integrity", () => {
  const originalEnvironment = process.env;
  const originalDev = __DEV__;

  afterEach(() => {
    process.env = originalEnvironment;
    Object.defineProperty(globalThis, "__DEV__", { value: originalDev });
    jest.restoreAllMocks();
  });

  test.each([
    ["ios", true],
    ["ios", false],
    ["android", true],
    ["android", false],
    ["web", false],
  ] as const)("configures local-only detection on %s with debug %s", async (platform, debug) => {
    process.env = {
      ...originalEnvironment,
      EXPO_PUBLIC_SYNAMEDIA_APPLICATION_ID: config.applicationId,
      EXPO_PUBLIC_SYNAMEDIA_GO_API_BASE_URL: config.goApiBaseUrl,
      EXPO_PUBLIC_SYNAMEDIA_PROJECT_ID: config.projectId,
      EXPO_PUBLIC_SYNAMEDIA_SCOPE: config.scope,
    };
    Object.defineProperty(globalThis, "__DEV__", { value: debug });
    mockConfigureSdk.mockClear().mockResolvedValue(undefined);
    let configure!: () => Promise<void>;
    jest.isolateModules(() => {
      mockPlatform.mockReturnValue(platform);
      configure =
        require("@/infra/common-sdk/configure-common-sdk").configureCommonSdk;
    });
    await configure();
    await configure();
    expect(mockConfigureSdk).toHaveBeenCalledTimes(1);
    const options = mockConfigureSdk.mock.calls[0]?.[0];
    if (platform === "web") {
      expect(options.deviceIntegrity).toBeUndefined();
    } else {
      expect(options.deviceIntegrity).toEqual({
        provider: expect.any(Function),
        debug,
      });
    }
    expect(options.synamedia).toEqual(config);
    expect(options.goAnalytics).toEqual({
      application: {
        appVersion: "4.2.0",
        deviceName: "Test device",
        deviceOs: `${platform} 17`,
        uiLanguage: "en",
      },
      storage: {
        getItem: expect.any(Function),
        setItem: expect.any(Function),
        removeItem: expect.any(Function),
      },
      onError: expect.any(Function),
    });
  });
});

describe("getGoAnalyticsApplicationMetadata", () => {
  test("uses the device OS version, not the Android API level", () => {
    mockPlatform.mockReturnValueOnce("android");
    mockOsVersion.mockReturnValueOnce("16");

    expect(getGoAnalyticsApplicationMetadata().deviceOs).toBe("android 16");
  });
});

describe("resetSynamediaStateOnConfigChange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFingerprint.mockReturnValue("current-fingerprint");
  });

  test("clears stored state and persists the fingerprint on first run", () => {
    mockReadFingerprint.mockReturnValue(null);

    resetSynamediaStateOnConfigChange(config);

    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockWriteFingerprint).toHaveBeenCalledWith("current-fingerprint");
  });

  test("clears stored state and persists the fingerprint when the config changed", () => {
    mockReadFingerprint.mockReturnValue("previous-fingerprint");

    resetSynamediaStateOnConfigChange(config);

    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockWriteFingerprint).toHaveBeenCalledWith("current-fingerprint");
  });

  test("keeps stored state when the config is unchanged", () => {
    mockReadFingerprint.mockReturnValue("current-fingerprint");

    resetSynamediaStateOnConfigChange(config);

    expect(mockClear).not.toHaveBeenCalled();
    expect(mockWriteFingerprint).not.toHaveBeenCalled();
  });
});
