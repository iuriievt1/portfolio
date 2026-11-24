import type { ConfigureSynamediaOptions } from "@bfbs/common-sdk";
import { getExpoSecureStoreModule } from "@/utils/expo-native-modules";

const SYNAMEDIA_CONFIG_FINGERPRINT_STORAGE_KEY = "bfbs.synamedia.config";

const secureStore = getExpoSecureStoreModule();
const fallbackStorage = new Map<string, string>();
const secureStoreOptions = secureStore?.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
  ? {
      keychainAccessible: secureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }
  : undefined;

/** Stable fingerprint of the Synamedia config values that identify a tenant. */
export function getSynamediaConfigFingerprint(
  config: ConfigureSynamediaOptions,
): string {
  return JSON.stringify({
    applicationId: config.applicationId,
    goApiBaseUrl: config.goApiBaseUrl,
    projectId: config.projectId,
    scope: config.scope ?? "",
  });
}

/** Reads the persisted Synamedia config fingerprint, or null when unset. */
export function readStoredSynamediaConfigFingerprint(): string | null {
  if (!secureStore) {
    return (
      fallbackStorage.get(SYNAMEDIA_CONFIG_FINGERPRINT_STORAGE_KEY) ?? null
    );
  }

  return secureStore.getItem(
    SYNAMEDIA_CONFIG_FINGERPRINT_STORAGE_KEY,
    secureStoreOptions,
  );
}

/** Persists the Synamedia config fingerprint for the current build. */
export function writeStoredSynamediaConfigFingerprint(
  fingerprint: string,
): void {
  if (!secureStore) {
    fallbackStorage.set(SYNAMEDIA_CONFIG_FINGERPRINT_STORAGE_KEY, fingerprint);
    return;
  }

  secureStore.setItem(
    SYNAMEDIA_CONFIG_FINGERPRINT_STORAGE_KEY,
    fingerprint,
    secureStoreOptions,
  );
}
