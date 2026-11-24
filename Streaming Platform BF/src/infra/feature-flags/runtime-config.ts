import type { LogLevel } from "@featurevisor/sdk";
import type { FeatureFlagMap } from "@/infra/feature-flags/featurevisor-service";

export type FeaturevisorEnvironment = "staging" | "production";
export type FeaturevisorLogLevel = LogLevel;

const FEATUREVISOR_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const FEATUREVISOR_BASE_URL =
  "https://bfbs-featurevisor.fv.api-fx.digital";
export const FEATUREVISOR_CLIENT = "bfbs-mobile";
const FEATUREVISOR_DATAFILE_NAME = "featurevisor-tag-mobile.json";
const FEATUREVISOR_DEFAULT_LOG_LEVEL: FeaturevisorLogLevel = "warn";
const FEATUREVISOR_LOG_LEVELS: FeaturevisorLogLevel[] = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
];
const FEATUREVISOR_REFRESH_INTERVAL_MS = 180 * 1000;
const FEATUREVISOR_REMOTE_TIMEOUT_MS = 5000;
const FEATUREVISOR_SURFACE = "mobile";

const getConfiguredValue = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const parseFeatureFlagQuery = (
  input: string | null | undefined,
): FeatureFlagMap => {
  if (!input) {
    return {};
  }

  const out: FeatureFlagMap = {};
  const entries = input.split(",").map((entry) => entry.trim());

  entries.forEach((entry) => {
    if (!entry) {
      return;
    }

    const [rawKey, rawValue] = entry.split(":");
    const key = rawKey?.trim();
    if (!key) {
      return;
    }

    const normalized = rawValue?.trim().toLowerCase();
    if (normalized === undefined || normalized === "") {
      out[key] = true;
      return;
    }

    if (["1", "true", "yes", "on"].includes(normalized)) {
      out[key] = true;
      return;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
      out[key] = false;
    }
  });

  return out;
};

const getSearchParam = (url: string | null | undefined, key: string) => {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).searchParams.get(key);
  } catch {
    const queryIndex = url.indexOf("?");

    if (queryIndex === -1) {
      return null;
    }

    return new URLSearchParams(url.slice(queryIndex + 1)).get(key);
  }
};

/**
 * Parses deep-link query-string flag overrides from a launch URL.
 */
export const getFeatureFlagOverridesFromUrl = (
  url: string | null | undefined,
): FeatureFlagMap => parseFeatureFlagQuery(getSearchParam(url, "ff"));

/**
 * Resolves the Featurevisor SDK log level used by the mobile runtime.
 */
export const getFeaturevisorLogLevel = (): FeaturevisorLogLevel => {
  const configured = getConfiguredValue(
    process.env.EXPO_PUBLIC_FEATUREVISOR_LOG_LEVEL,
  );

  if (
    configured &&
    FEATUREVISOR_LOG_LEVELS.includes(configured as FeaturevisorLogLevel)
  ) {
    return configured as FeaturevisorLogLevel;
  }

  return FEATUREVISOR_DEFAULT_LOG_LEVEL;
};

/**
 * Resolves the Featurevisor environment for the current app build.
 */
export const getFeaturevisorEnvironment = (): FeaturevisorEnvironment => {
  const configured = getConfiguredValue(
    process.env.EXPO_PUBLIC_FEATUREVISOR_ENVIRONMENT,
  );

  if (configured === "staging" || configured === "production") {
    return configured;
  }

  return "staging";
};

/**
 * Builds the BFBS Mobile Featurevisor datafile URL for a given environment.
 */
export const buildFeaturevisorDatafileUrl = ({
  environment,
  baseUrl,
}: {
  environment: FeaturevisorEnvironment;
  baseUrl: string;
}) => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const datafilesBaseUrl = normalizedBaseUrl.endsWith("/datafiles")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/datafiles`;

  return {
    url: `${datafilesBaseUrl}/${environment}/${FEATUREVISOR_DATAFILE_NAME}`,
  };
};

/**
 * Builds the fixed BFBS Mobile runtime context sent to Featurevisor evaluations.
 */
export const buildFeaturevisorContext = () => ({
  client: FEATUREVISOR_CLIENT,
  surface: FEATUREVISOR_SURFACE,
});

export const FEATUREVISOR_FETCH_OPTIONS = {
  timeoutMs: FEATUREVISOR_REMOTE_TIMEOUT_MS,
  useCache: true,
  cacheMaxAgeMs: FEATUREVISOR_CACHE_MAX_AGE_MS,
  useConditionalRequest: true,
};

export const FEATUREVISOR_REFRESH_INTERVAL = FEATUREVISOR_REFRESH_INTERVAL_MS;
