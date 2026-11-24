import * as Linking from "expo-linking";
import { featurevisorService } from "@/infra/feature-flags/featurevisor-service";
import {
  buildFeaturevisorContext,
  buildFeaturevisorDatafileUrl,
  FEATUREVISOR_BASE_URL,
  FEATUREVISOR_FETCH_OPTIONS,
  FEATUREVISOR_REFRESH_INTERVAL,
  getFeatureFlagOverridesFromUrl,
  getFeaturevisorEnvironment,
  getFeaturevisorLogLevel,
} from "@/infra/feature-flags/runtime-config";

/**
 * Initializes Featurevisor for BFBS Mobile, hydrates any warm cache, and
 * starts non-blocking background refreshes for the remote datafile.
 */
export const initFeatureFlags = async (): Promise<void> => {
  // Prefer Expo's synchronous launch URL so startup doesn't join the same
  // async initial-linking race that Expo Router handles during refresh.
  const initialUrl = Linking.getLinkingURL();
  const logLevel = getFeaturevisorLogLevel();
  const overrides = getFeatureFlagOverridesFromUrl(initialUrl);
  const environment = getFeaturevisorEnvironment();
  const { url } = buildFeaturevisorDatafileUrl({
    baseUrl: FEATUREVISOR_BASE_URL,
    environment,
  });

  featurevisorService.init({
    context: buildFeaturevisorContext(),
    logLevel,
    overrides,
  });

  await featurevisorService
    .hydrateFromCache({
      cacheMaxAgeMs: FEATUREVISOR_FETCH_OPTIONS.cacheMaxAgeMs,
    })
    .catch(() => false);

  featurevisorService
    .refreshDatafile({
      url,
      ...FEATUREVISOR_FETCH_OPTIONS,
    })
    .then(() => undefined)
    .catch(() => undefined);

  featurevisorService.startAutoRefresh({
    url,
    ...FEATUREVISOR_FETCH_OPTIONS,
    refreshIntervalMs: FEATUREVISOR_REFRESH_INTERVAL,
  });
};

export default initFeatureFlags;
