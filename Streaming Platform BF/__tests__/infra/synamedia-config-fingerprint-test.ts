const mockGetExpoSecureStoreModule = jest.fn();

jest.mock("@/utils/expo-native-modules", () => ({
  getExpoSecureStoreModule: () => mockGetExpoSecureStoreModule(),
}));

type FingerprintModule =
  typeof import("@/infra/common-sdk/utils/synamedia-config-fingerprint");

function loadFingerprintModule(): FingerprintModule {
  let loaded: FingerprintModule | undefined;

  jest.isolateModules(() => {
    loaded = require("@/infra/common-sdk/utils/synamedia-config-fingerprint");
  });

  return loaded as FingerprintModule;
}

const baseConfig = {
  applicationId: "app-id",
  goApiBaseUrl: "https://go.example",
  projectId: "project-id",
  scope: "scope-value",
};

describe("synamedia config fingerprint", () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetExpoSecureStoreModule.mockReset();
  });

  test("is stable for equal config values", () => {
    mockGetExpoSecureStoreModule.mockReturnValue(null);
    const { getSynamediaConfigFingerprint } = loadFingerprintModule();

    expect(getSynamediaConfigFingerprint(baseConfig)).toBe(
      getSynamediaConfigFingerprint({ ...baseConfig }),
    );
  });

  test("changes when any config value changes", () => {
    mockGetExpoSecureStoreModule.mockReturnValue(null);
    const { getSynamediaConfigFingerprint } = loadFingerprintModule();
    const base = getSynamediaConfigFingerprint(baseConfig);

    expect(
      getSynamediaConfigFingerprint({ ...baseConfig, applicationId: "x" }),
    ).not.toBe(base);
    expect(
      getSynamediaConfigFingerprint({ ...baseConfig, goApiBaseUrl: "x" }),
    ).not.toBe(base);
    expect(
      getSynamediaConfigFingerprint({ ...baseConfig, projectId: "x" }),
    ).not.toBe(base);
    expect(
      getSynamediaConfigFingerprint({ ...baseConfig, scope: "x" }),
    ).not.toBe(base);
  });

  test("reads and writes via the in-memory fallback when secure store is unavailable", () => {
    mockGetExpoSecureStoreModule.mockReturnValue(null);
    const loaded = loadFingerprintModule();

    expect(loaded.readStoredSynamediaConfigFingerprint()).toBeNull();

    loaded.writeStoredSynamediaConfigFingerprint("fingerprint");

    expect(loaded.readStoredSynamediaConfigFingerprint()).toBe("fingerprint");
  });

  test("reads and writes via expo secure store when available", () => {
    const secureStore = {
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "after-first-unlock",
      deleteItemAsync: jest.fn().mockResolvedValue(undefined),
      getItem: jest.fn().mockReturnValue("stored-fingerprint"),
      setItem: jest.fn(),
    };
    mockGetExpoSecureStoreModule.mockReturnValue(secureStore);
    const loaded = loadFingerprintModule();

    expect(loaded.readStoredSynamediaConfigFingerprint()).toBe(
      "stored-fingerprint",
    );

    loaded.writeStoredSynamediaConfigFingerprint("next-fingerprint");

    expect(secureStore.getItem).toHaveBeenCalledWith("bfbs.synamedia.config", {
      keychainAccessible: "after-first-unlock",
    });
    expect(secureStore.setItem).toHaveBeenCalledWith(
      "bfbs.synamedia.config",
      "next-fingerprint",
      { keychainAccessible: "after-first-unlock" },
    );
  });
});
