import type {
  ConfigureSdkOptions,
  ConfigureSynamediaOptions,
  GoAnalyticsOptions,
} from "@bfbs/common-sdk";
import { configureSdk, SynamediaGoClient } from "@bfbs/common-sdk";
import { NativeDeviceIntegrityService } from "@bfbs/common-sdk/device-integrity/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { getAppVersionMetadata } from "@/infra/app-version/app-version-metadata";
import { reportError } from "@/infra/error";
import { mobileStorage } from "./utils/mobile-storage";
import {
  getSynamediaConfigFingerprint,
  readStoredSynamediaConfigFingerprint,
  writeStoredSynamediaConfigFingerprint,
} from "./utils/synamedia-config-fingerprint";

/** Throws when the value is missing. */
export function getRequiredEnvironmentValue(
  name: string,
  value: string | undefined,
) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return trimmedValue;
}

export function getSynamediaConfiguration(): ConfigureSynamediaOptions {
  return {
    applicationId: getRequiredEnvironmentValue(
      "EXPO_PUBLIC_SYNAMEDIA_APPLICATION_ID",
      process.env.EXPO_PUBLIC_SYNAMEDIA_APPLICATION_ID,
    ),
    goApiBaseUrl: getRequiredEnvironmentValue(
      "EXPO_PUBLIC_SYNAMEDIA_GO_API_BASE_URL",
      process.env.EXPO_PUBLIC_SYNAMEDIA_GO_API_BASE_URL,
    ),
    projectId: getRequiredEnvironmentValue(
      "EXPO_PUBLIC_SYNAMEDIA_PROJECT_ID",
      process.env.EXPO_PUBLIC_SYNAMEDIA_PROJECT_ID,
    ),
    scope: getRequiredEnvironmentValue(
      "EXPO_PUBLIC_SYNAMEDIA_SCOPE",
      process.env.EXPO_PUBLIC_SYNAMEDIA_SCOPE,
    ),
  };
}

/** Returns the app version, device and language sent with GO Analytics. */
export function getGoAnalyticsApplicationMetadata(): GoAnalyticsOptions["application"] {
  const appVersion = getAppVersionMetadata();

  return {
    appVersion: appVersion.version,
    deviceName: Device.modelName ?? "Unknown device",
    // Platform.Version on Android is the API level, not the OS version.
    deviceOs: `${Platform.OS} ${Device.osVersion ?? String(Platform.Version)}`,
    uiLanguage: "en",
  };
}

let hasReportedGoAnalyticsError = false;

function getGoAnalyticsConfiguration(): GoAnalyticsOptions {
  return {
    storage: {
      getItem: (key) => AsyncStorage.getItem(key),
      setItem: (key, value) => AsyncStorage.setItem(key, value),
      removeItem: (key) => AsyncStorage.removeItem(key),
    },
    application: getGoAnalyticsApplicationMetadata(),
    onError: () => {
      if (hasReportedGoAnalyticsError) {
        return;
      }

      hasReportedGoAnalyticsError = true;
      reportError(new Error("GO Analytics SDK error"), {
        tags: { area: "analytics", operation: "sdk_error" },
      });
    },
  };
}

let commonSdkConfigurationPromise: Promise<void> | undefined;
let hasInstalledSynamediaFormBodyPatch = false;

function encodeFormComponent(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function createReactNativeFormBody(values: Record<string, string | undefined>) {
  return Object.entries(values)
    .flatMap(([key, value]) =>
      value === undefined
        ? []
        : [`${encodeFormComponent(key)}=${encodeFormComponent(value)}`],
    )
    .join("&") as unknown as URLSearchParams;
}

function installSynamediaReactNativeFormBodyPatch() {
  if (hasInstalledSynamediaFormBodyPatch) {
    return;
  }

  hasInstalledSynamediaFormBodyPatch = true;
  SynamediaGoClient.toFormData = createReactNativeFormBody;
}

/** Configures shared storage, Synamedia, analytics and native integrity detection once. */
export function configureCommonSdk(): Promise<void> {
  installSynamediaReactNativeFormBodyPatch();

  commonSdkConfigurationPromise ??= configureCommonSdkInternal();

  return commonSdkConfigurationPromise;
}

/** Clears the saved Synamedia login state when the tenant config changed, so a stale WZ identity isn't reused against production. */
export function resetSynamediaStateOnConfigChange(
  config: ConfigureSynamediaOptions,
): void {
  const fingerprint = getSynamediaConfigFingerprint(config);

  if (readStoredSynamediaConfigFingerprint() === fingerprint) {
    return;
  }

  mobileStorage.clear();
  writeStoredSynamediaConfigFingerprint(fingerprint);
}

async function configureCommonSdkInternal() {
  try {
    const synamedia = getSynamediaConfiguration();

    resetSynamediaStateOnConfigChange(synamedia);

    const options: ConfigureSdkOptions = {
      goAnalytics: getGoAnalyticsConfiguration(),
      synamedia,
      storage: mobileStorage,
    };
    if (Platform.OS === "ios" || Platform.OS === "android") {
      options.deviceIntegrity = {
        provider: NativeDeviceIntegrityService,
        debug: __DEV__,
      };
    }
    await configureSdk(options);
  } catch (error) {
    commonSdkConfigurationPromise = undefined;
    throw error;
  }
}
