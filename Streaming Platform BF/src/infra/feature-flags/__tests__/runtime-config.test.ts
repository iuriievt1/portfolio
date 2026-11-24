import {
  buildFeaturevisorContext,
  buildFeaturevisorDatafileUrl,
  FEATUREVISOR_BASE_URL,
  FEATUREVISOR_CLIENT,
  FEATUREVISOR_FETCH_OPTIONS,
  FEATUREVISOR_REFRESH_INTERVAL,
  getFeatureFlagOverridesFromUrl,
  getFeaturevisorEnvironment,
  getFeaturevisorLogLevel,
} from "../runtime-config";

describe("Featurevisor runtime config", () => {
  const originalEnvironment = process.env.EXPO_PUBLIC_FEATUREVISOR_ENVIRONMENT;
  const originalLogLevel = process.env.EXPO_PUBLIC_FEATUREVISOR_LOG_LEVEL;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_FEATUREVISOR_ENVIRONMENT;
    delete process.env.EXPO_PUBLIC_FEATUREVISOR_LOG_LEVEL;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_FEATUREVISOR_ENVIRONMENT = originalEnvironment;
    process.env.EXPO_PUBLIC_FEATUREVISOR_LOG_LEVEL = originalLogLevel;
  });

  it("uses the fixed BFBS Mobile client and base URL when no explicit config is present", () => {
    expect(FEATUREVISOR_CLIENT).toBe("bfbs-mobile");
    expect(FEATUREVISOR_BASE_URL).toBe(
      "https://bfbs-featurevisor.fv.api-fx.digital",
    );
    expect(getFeaturevisorEnvironment()).toBe("staging");
    expect(getFeaturevisorLogLevel()).toBe("warn");
    expect(FEATUREVISOR_FETCH_OPTIONS).toEqual({
      timeoutMs: 5000,
      useCache: true,
      cacheMaxAgeMs: 86_400_000,
      useConditionalRequest: true,
    });
    expect(FEATUREVISOR_REFRESH_INTERVAL).toBe(180_000);
  });

  it("still allows environment and log level env overrides", () => {
    process.env.EXPO_PUBLIC_FEATUREVISOR_ENVIRONMENT = "production";
    process.env.EXPO_PUBLIC_FEATUREVISOR_LOG_LEVEL = "error";

    expect(getFeaturevisorEnvironment()).toBe("production");
    expect(getFeaturevisorLogLevel()).toBe("error");
  });

  it("falls back to defaults when invalid Featurevisor env values are configured", () => {
    process.env.EXPO_PUBLIC_FEATUREVISOR_ENVIRONMENT = "qa";
    process.env.EXPO_PUBLIC_FEATUREVISOR_LOG_LEVEL = "verbose";

    expect(getFeaturevisorEnvironment()).toBe("staging");
    expect(getFeaturevisorLogLevel()).toBe("warn");
  });

  it("builds the BFBS Mobile context, URL, and deep-link overrides", () => {
    expect(buildFeaturevisorContext()).toEqual({
      client: "bfbs-mobile",
      surface: "mobile",
    });
    expect(
      buildFeaturevisorDatafileUrl({
        baseUrl: "https://flags.example/",
        environment: "staging",
      }),
    ).toEqual({
      url: "https://flags.example/datafiles/staging/featurevisor-tag-mobile.json",
    });
    expect(
      buildFeaturevisorDatafileUrl({
        baseUrl: "https://flags.example/datafiles/",
        environment: "production",
      }),
    ).toEqual({
      url: "https://flags.example/datafiles/production/featurevisor-tag-mobile.json",
    });
    expect(
      getFeatureFlagOverridesFromUrl(
        "bfbsmobile://my-bfbs?ff=ui.navbarProfileIcon:false,ops.featurevisorSmokeTest:on",
      ),
    ).toEqual({
      "ui.navbarProfileIcon": false,
      "ops.featurevisorSmokeTest": true,
    });
  });
});
