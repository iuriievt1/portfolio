import { FeaturevisorFlagService } from "../featurevisor-service";

const mockGetAllEvaluations = jest.fn();
const mockGetFeature = jest.fn<object | undefined, [string]>(() => ({}));
const mockGetVariation = jest.fn();
const mockGetVariable = jest.fn();
const mockIsEnabled = jest.fn();
const mockSetLogLevel = jest.fn();
const mockSetContext = jest.fn();
const mockSetDatafile = jest.fn();
const mockCreateInstance = jest.fn<unknown, [unknown]>(() => ({
  getAllEvaluations: mockGetAllEvaluations,
  getFeature: mockGetFeature,
  getVariation: mockGetVariation,
  getVariable: mockGetVariable,
  isEnabled: mockIsEnabled,
  setLogLevel: mockSetLogLevel,
  setContext: mockSetContext,
  setDatafile: mockSetDatafile,
}));

jest.mock("@featurevisor/sdk", () => ({
  createInstance: (options: unknown) => mockCreateInstance(options),
}));

const mockGetItem = jest.fn<Promise<string | null>, [string]>();
const mockRemoveItem = jest.fn<Promise<void>, [string]>(() =>
  Promise.resolve(),
);
const mockSetItem = jest.fn<Promise<void>, [string, string]>(() =>
  Promise.resolve(),
);

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    removeItem: (key: string) => mockRemoveItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

const setCachedStorageState = (entries: Record<string, string | null>) => {
  mockGetItem.mockImplementation((key: string) =>
    Promise.resolve(entries[key] ?? null),
  );
};

describe("FeaturevisorFlagService", () => {
  const cachedDatafile = {
    features: {},
    revision: "rev-1",
    schemaVersion: "2",
    segments: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFeature.mockReturnValue({});
    mockIsEnabled.mockReturnValue(true);
    setCachedStorageState({
      "featurevisor:datafile": null,
      "featurevisor:datafileFetchedAt": null,
      "featurevisor:datafileEtag": null,
    });
    global.fetch = jest.fn();
  });

  it("hydrates a fresh cached datafile before using remote refreshes", async () => {
    setCachedStorageState({
      "featurevisor:datafile": JSON.stringify(cachedDatafile),
      "featurevisor:datafileFetchedAt": String(Date.now()),
      "featurevisor:datafileEtag": "etag-1",
    });

    const service = new FeaturevisorFlagService();
    const hydrated = await service.hydrateFromCache({ cacheMaxAgeMs: 1000 });

    expect(hydrated).toBe(true);
    expect(mockGetItem).toHaveBeenCalledWith("featurevisor:datafile");
    expect(mockGetItem).toHaveBeenCalledWith("featurevisor:datafileFetchedAt");
    expect(mockGetItem).toHaveBeenCalledWith("featurevisor:datafileEtag");
    expect(mockCreateInstance).toHaveBeenCalledWith({
      datafile: cachedDatafile,
    });
  });

  it("uses local overrides before any SDK evaluation", () => {
    const service = new FeaturevisorFlagService();

    service.init({
      overrides: {
        "ui.navbarProfileIcon": false,
      },
    });

    expect(service.isEnabled("ui.navbarProfileIcon", {}, true)).toBe(false);
    expect(mockIsEnabled).not.toHaveBeenCalled();
  });

  it("passes the configured log level through to the Featurevisor SDK", () => {
    const service = new FeaturevisorFlagService();

    service.init({
      context: {
        client: "bfbs-mobile",
      },
      logLevel: "warn",
    });

    expect(mockCreateInstance).toHaveBeenCalledWith({
      context: {
        client: "bfbs-mobile",
      },
      logLevel: "warn",
    });
  });

  it.each([
    true,
    false,
  ])("uses fallback %s when a loaded datafile lacks the flag", (fallback) => {
    const service = new FeaturevisorFlagService();
    service.init({ datafile: cachedDatafile });
    mockGetFeature.mockReturnValue(undefined);
    expect(service.isEnabled("auth.deviceIntegrity", {}, fallback)).toBe(
      fallback,
    );
    expect(mockIsEnabled).not.toHaveBeenCalled();
  });

  it("keeps an explicitly disabled cached integrity flag when refresh is unavailable", async () => {
    const { createInstance } =
      jest.requireActual<typeof import("@featurevisor/sdk")>(
        "@featurevisor/sdk",
      );
    mockCreateInstance.mockImplementationOnce((options) =>
      createInstance(options as Parameters<typeof createInstance>[0]),
    );
    setCachedStorageState({
      "featurevisor:datafile": JSON.stringify({
        ...cachedDatafile,
        features: {
          "auth.deviceIntegrity": {
            bucketBy: "client",
            traffic: [{ key: "disabled", segments: "*", percentage: 0 }],
          },
        },
      }),
      "featurevisor:datafileFetchedAt": String(Date.now()),
    });
    const service = new FeaturevisorFlagService();
    service.init({ context: { client: "bfbs-mobile" }, logLevel: "warn" });
    await service.hydrateFromCache();
    expect(service.isEnabled("auth.deviceIntegrity", {}, true)).toBe(false);
    jest.mocked(global.fetch).mockRejectedValue(new Error("offline"));
    await service.refreshDatafile({ url: "https://flags.example/mobile.json" });
    expect(service.isEnabled("auth.deviceIntegrity", {}, true)).toBe(false);
    service.setDatafile(cachedDatafile);
    expect(service.isEnabled("auth.deviceIntegrity", {}, true)).toBe(true);
  });

  it("falls back to a fresh cached datafile when the remote refresh fails", async () => {
    setCachedStorageState({
      "featurevisor:datafile": JSON.stringify(cachedDatafile),
      "featurevisor:datafileFetchedAt": String(Date.now()),
      "featurevisor:datafileEtag": "etag-1",
    });
    jest.mocked(global.fetch).mockRejectedValue(new Error("network"));

    const service = new FeaturevisorFlagService();
    service.init({
      context: {
        client: "bfbs-mobile",
      },
    });

    const result = await service.refreshDatafile({
      url: "https://flags.example/staging/featurevisor-tag-mobile.json",
      cacheMaxAgeMs: 1000,
    });

    expect(result).toEqual({
      status: "applied-cache",
      source: "cache",
    });
    expect(mockSetDatafile).toHaveBeenCalledWith(cachedDatafile);
  });

  it("does not reapply stale cached data when the remote refresh fails", async () => {
    setCachedStorageState({
      "featurevisor:datafile": JSON.stringify(cachedDatafile),
      "featurevisor:datafileFetchedAt": String(Date.now() - 86_400_001),
      "featurevisor:datafileEtag": "etag-1",
    });
    jest.mocked(global.fetch).mockRejectedValue(new Error("network"));

    const service = new FeaturevisorFlagService();
    service.init({
      context: {
        client: "bfbs-mobile",
      },
    });

    const result = await service.refreshDatafile({
      url: "https://flags.example/staging/featurevisor-tag-mobile.json",
      cacheMaxAgeMs: 1000,
    });

    expect(result).toEqual({
      status: "error",
    });
    expect(mockSetDatafile).not.toHaveBeenCalled();
  });

  it("reuses a cached datafile and refreshes its timestamp on 304 responses", async () => {
    setCachedStorageState({
      "featurevisor:datafile": JSON.stringify(cachedDatafile),
      "featurevisor:datafileFetchedAt": String(Date.now() - 86_400_001),
      "featurevisor:datafileEtag": "etag-1",
    });
    jest.mocked(global.fetch).mockResolvedValue({
      headers: {
        get: jest.fn(() => "etag-1"),
      },
      ok: false,
      status: 304,
    } as unknown as Response);

    const service = new FeaturevisorFlagService();
    service.init({
      context: {
        client: "bfbs-mobile",
      },
    });

    const result = await service.refreshDatafile({
      url: "https://flags.example/staging/featurevisor-tag-mobile.json",
      cacheMaxAgeMs: 1000,
      useConditionalRequest: true,
    });

    expect(result).toEqual({
      status: "not-modified",
      source: "cache",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://flags.example/staging/featurevisor-tag-mobile.json",
      expect.objectContaining({
        headers: {
          "If-None-Match": "etag-1",
        },
      }),
    );
    expect(mockSetDatafile).toHaveBeenCalledWith(cachedDatafile);
    expect(mockSetItem).toHaveBeenCalledWith(
      "featurevisor:datafileFetchedAt",
      expect.any(String),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "featurevisor:datafileEtag",
      "etag-1",
    );
  });

  it("saves and applies a fresh remote datafile when the request succeeds", async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      headers: {
        get: jest.fn(() => "etag-2"),
      },
      json: jest.fn(() => Promise.resolve(cachedDatafile)),
      ok: true,
      status: 200,
    } as unknown as Response);

    const service = new FeaturevisorFlagService();
    service.init({
      context: {
        client: "bfbs-mobile",
      },
    });

    const result = await service.refreshDatafile({
      url: "https://flags.example/staging/featurevisor-tag-mobile.json",
    });

    expect(result).toEqual({
      status: "applied-remote",
      source: "remote",
    });
    expect(mockSetItem).toHaveBeenCalledWith(
      "featurevisor:datafile",
      JSON.stringify(cachedDatafile),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "featurevisor:datafileEtag",
      "etag-2",
    );
    expect(mockSetDatafile).toHaveBeenCalledWith(cachedDatafile);
  });
});
