const mockGetExpoSecureStoreModule = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  SYNAMEDIA_CLIENT_STATE_STORAGE_KEY: "bfbs.client-state",
  SYNAMEDIA_TOKENS_STORAGE_KEY: "bfbs.tokens",
}));

jest.mock("@/utils/expo-native-modules", () => ({
  getExpoSecureStoreModule: () => mockGetExpoSecureStoreModule(),
}));

function loadMobileStorage() {
  let mobileStorage: Storage | undefined;

  jest.isolateModules(() => {
    mobileStorage =
      require("@/infra/common-sdk/utils/mobile-storage").mobileStorage;
  });

  return mobileStorage as Storage;
}

describe("mobileStorage", () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetExpoSecureStoreModule.mockReset();
  });

  test("falls back to in-memory storage when expo secure store is unavailable", () => {
    mockGetExpoSecureStoreModule.mockReturnValue(null);
    const mobileStorage = loadMobileStorage();

    mobileStorage.setItem("bfbs.tokens", "token-value");

    expect(mobileStorage.getItem("bfbs.tokens")).toBe("token-value");
    expect(mobileStorage.length).toBe(1);

    mobileStorage.removeItem("bfbs.tokens");

    expect(mobileStorage.getItem("bfbs.tokens")).toBeNull();
  });

  test("uses expo secure store when the native module is available", () => {
    const secureStore = {
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "after-first-unlock",
      deleteItemAsync: jest.fn().mockResolvedValue(undefined),
      getItem: jest.fn().mockReturnValue("stored-value"),
      setItem: jest.fn(),
    };
    mockGetExpoSecureStoreModule.mockReturnValue(secureStore);
    const mobileStorage = loadMobileStorage();

    expect(mobileStorage.getItem("bfbs.tokens")).toBe("stored-value");

    mobileStorage.setItem("bfbs.tokens", "next-value");
    mobileStorage.removeItem("bfbs.tokens");

    expect(secureStore.setItem).toHaveBeenCalledWith(
      "bfbs.tokens",
      "next-value",
      { keychainAccessible: "after-first-unlock" },
    );
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith("bfbs.tokens", {
      keychainAccessible: "after-first-unlock",
    });
  });
});
