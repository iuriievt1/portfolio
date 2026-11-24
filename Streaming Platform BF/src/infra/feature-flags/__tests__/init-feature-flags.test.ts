import { initFeatureFlags } from "../init-feature-flags";

const mockGetLinkingURL = jest.fn();

jest.mock("expo-linking", () => ({
  getLinkingURL: () => mockGetLinkingURL(),
}));

const mockHydrateFromCache = jest.fn();
const mockInit = jest.fn();
const mockRefreshDatafile = jest.fn();
const mockStartAutoRefresh = jest.fn();
const mockStopAutoRefresh = jest.fn();

jest.mock("@/infra/feature-flags/featurevisor-service", () => ({
  featurevisorService: {
    hydrateFromCache: (options: unknown) => mockHydrateFromCache(options),
    init: (options?: unknown) => mockInit(options),
    refreshDatafile: (options: unknown) => mockRefreshDatafile(options),
    startAutoRefresh: (options: unknown) => mockStartAutoRefresh(options),
    stopAutoRefresh: () => mockStopAutoRefresh(),
  },
}));

const createDeferred = <T>() => {
  let resolveDeferred!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve;
  });

  return { promise, resolve: resolveDeferred };
};

describe("initFeatureFlags", () => {
  const originalEnvironment = process.env.EXPO_PUBLIC_FEATUREVISOR_ENVIRONMENT;
  const originalLogLevel = process.env.EXPO_PUBLIC_FEATUREVISOR_LOG_LEVEL;

  beforeEach(() => {
    mockStopAutoRefresh();
    jest.clearAllMocks();
    mockStartAutoRefresh.mockReturnValue(undefined);
    process.env.EXPO_PUBLIC_FEATUREVISOR_CLIENT = "bfbs-mobile-local";
    process.env.EXPO_PUBLIC_FEATUREVISOR_BASE_URL = "https://flags.example";
    process.env.EXPO_PUBLIC_FEATUREVISOR_ENVIRONMENT = "staging";
    delete process.env.EXPO_PUBLIC_FEATUREVISOR_LOG_LEVEL;
    mockGetLinkingURL.mockReturnValue(
      "bfbsmobile://my-bfbs?ff=ui.navbarProfileIcon:false",
    );
    mockHydrateFromCache.mockResolvedValue(true);
    mockRefreshDatafile.mockResolvedValue({
      status: "applied-remote",
      source: "remote",
    });
  });

  afterAll(() => {
    mockStopAutoRefresh();
    delete process.env.EXPO_PUBLIC_FEATUREVISOR_CLIENT;
    delete process.env.EXPO_PUBLIC_FEATUREVISOR_BASE_URL;
    process.env.EXPO_PUBLIC_FEATUREVISOR_ENVIRONMENT = originalEnvironment;
    process.env.EXPO_PUBLIC_FEATUREVISOR_LOG_LEVEL = originalLogLevel;
  });

  it("hydrates cache and starts remote refreshes without blocking bootstrap", async () => {
    const deferredRefresh = createDeferred<{
      source: "remote";
      status: "applied-remote";
    }>();
    mockRefreshDatafile.mockReturnValue(deferredRefresh.promise);

    await expect(initFeatureFlags()).resolves.toBeUndefined();

    expect(mockInit).toHaveBeenCalledWith({
      context: {
        client: "bfbs-mobile",
        surface: "mobile",
      },
      logLevel: "warn",
      overrides: {
        "ui.navbarProfileIcon": false,
      },
    });
    expect(mockHydrateFromCache).toHaveBeenCalledWith({
      cacheMaxAgeMs: 86_400_000,
    });
    expect(mockRefreshDatafile).toHaveBeenCalledWith({
      cacheMaxAgeMs: 86_400_000,
      timeoutMs: 5000,
      url: "https://bfbs-featurevisor.fv.api-fx.digital/datafiles/staging/featurevisor-tag-mobile.json",
      useCache: true,
      useConditionalRequest: true,
    });
    expect(mockStartAutoRefresh).toHaveBeenCalledWith({
      cacheMaxAgeMs: 86_400_000,
      refreshIntervalMs: 180_000,
      timeoutMs: 5000,
      url: "https://bfbs-featurevisor.fv.api-fx.digital/datafiles/staging/featurevisor-tag-mobile.json",
      useCache: true,
      useConditionalRequest: true,
    });

    deferredRefresh.resolve({
      status: "applied-remote",
      source: "remote",
    });
    await deferredRefresh.promise;
  });
});
