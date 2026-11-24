import {
  SYNAMEDIA_CLIENT_STATE_STORAGE_KEY,
  SYNAMEDIA_TOKENS_STORAGE_KEY,
} from "@bfbs/common-sdk";
import { getExpoSecureStoreModule } from "@/utils/expo-native-modules";

const secureStore = getExpoSecureStoreModule();
const fallbackStorage = new Map<string, string>();
const secureStoreOptions = secureStore?.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
  ? {
      keychainAccessible: secureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }
  : undefined;

const storageKeys = [
  SYNAMEDIA_CLIENT_STATE_STORAGE_KEY,
  SYNAMEDIA_TOKENS_STORAGE_KEY,
] as const;

function getStoredValue(key: string) {
  if (!secureStore) {
    return fallbackStorage.get(key) ?? null;
  }

  return secureStore.getItem(key, secureStoreOptions);
}

function setStoredValue(key: string, value: string) {
  if (!secureStore) {
    fallbackStorage.set(key, value);
    return;
  }

  secureStore.setItem(key, value, secureStoreOptions);
}

function deleteStoredValue(key: string) {
  if (!secureStore) {
    fallbackStorage.delete(key);
    return;
  }

  setStoredValue(key, "");
  void secureStore.deleteItemAsync(key, secureStoreOptions);
}

export const mobileStorage: Storage = {
  get length() {
    return storageKeys.filter((key) => Boolean(getStoredValue(key))).length;
  },
  clear: () => {
    for (const key of storageKeys) {
      deleteStoredValue(key);
    }
  },
  getItem: (key) => getStoredValue(key),
  key: (index) =>
    storageKeys.filter((key) => Boolean(getStoredValue(key)))[index] ?? null,
  removeItem: (key) => {
    deleteStoredValue(key);
  },
  setItem: (key, value) => {
    setStoredValue(key, value);
  },
};
