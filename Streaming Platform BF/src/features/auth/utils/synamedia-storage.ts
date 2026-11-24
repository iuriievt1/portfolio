import type { AuthTokens, SynamediaClientState } from "@bfbs/common-sdk";
import {
  SYNAMEDIA_CLIENT_STATE_STORAGE_KEY,
  SYNAMEDIA_TOKENS_STORAGE_KEY,
} from "@bfbs/common-sdk";

import { mobileStorage } from "@/infra/common-sdk/utils/mobile-storage";

function parseStorageJson<T>(storage: Storage, key: string): T | null {
  const value = storage.getItem(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function getStoredSynamediaTokens(storage: Storage = mobileStorage) {
  return parseStorageJson<AuthTokens>(storage, SYNAMEDIA_TOKENS_STORAGE_KEY);
}

export function getStoredSynamediaClientState(
  storage: Storage = mobileStorage,
) {
  return parseStorageJson<SynamediaClientState>(
    storage,
    SYNAMEDIA_CLIENT_STATE_STORAGE_KEY,
  );
}

export function hasStoredSynamediaAuthSession(
  storage: Storage = mobileStorage,
) {
  const tokens = getStoredSynamediaTokens(storage);

  return Boolean(tokens?.accessToken);
}
