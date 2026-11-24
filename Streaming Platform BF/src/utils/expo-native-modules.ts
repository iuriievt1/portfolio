type DeviceModule = {
  deviceType: unknown;
  DeviceType: {
    PHONE: unknown;
    TABLET: unknown;
  };
};

type ScreenOrientationModule = {
  OrientationLock: {
    LANDSCAPE: unknown;
    PORTRAIT_UP: unknown;
  };
  lockAsync: (orientationLock: unknown) => Promise<void>;
  unlockAsync: () => Promise<void>;
};

export type NetworkStateSnapshot = {
  isConnected?: boolean | undefined;
  isInternetReachable?: boolean | undefined;
  type?: string | undefined;
};

type NetworkModule = {
  addNetworkStateListener: (
    listener: (state: NetworkStateSnapshot) => void,
  ) => { remove: () => void };
  getIpAddressAsync: () => Promise<string>;
  getNetworkStateAsync: () => Promise<NetworkStateSnapshot>;
};

type SecureStoreModule = {
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY?: string;
  deleteItemAsync: (key: string, options?: object) => Promise<void>;
  getItem: (key: string, options?: object) => string | null;
  setItem: (key: string, value: string, options?: object) => void;
};

const warnedMissingModules = new Set<string>();

const fallbackDeviceModule: DeviceModule = {
  DeviceType: {
    PHONE: "phone",
    TABLET: "tablet",
  },
  deviceType: null,
};

const fallbackScreenOrientationModule: ScreenOrientationModule = {
  OrientationLock: {
    LANDSCAPE: "landscape",
    PORTRAIT_UP: "portrait-up",
  },
  lockAsync: async () => {},
  unlockAsync: async () => {},
};

/** Never look offline. */
const fallbackNetworkModule: NetworkModule = {
  addNetworkStateListener: () => ({ remove: () => {} }),
  getIpAddressAsync: async () => "",
  getNetworkStateAsync: async () => ({
    isConnected: true,
    isInternetReachable: true,
  }),
};

function isMissingNativeModuleError(error: unknown, moduleName: string) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Cannot find native module") ||
    error.message.includes(`Cannot find module '${moduleName}'`) ||
    error.message.includes(`Cannot find module "${moduleName}"`)
  );
}

function warnMissingModule(moduleName: string) {
  if (!__DEV__ || warnedMissingModules.has(moduleName)) {
    return;
  }

  warnedMissingModules.add(moduleName);
  console.warn(
    `[native-module] Falling back because '${moduleName}' is unavailable in the current binary.`,
  );
}

function requireOptionalModule<T>({
  load,
  moduleName,
}: {
  load: () => T;
  moduleName: string;
}) {
  try {
    return load();
  } catch (error) {
    if (!isMissingNativeModuleError(error, moduleName)) {
      throw error;
    }

    warnMissingModule(moduleName);
    return null;
  }
}

/** Returns `expo-device` when present, or a JS fallback when the native binary is stale. */
export function getExpoDeviceModule() {
  return (
    requireOptionalModule<DeviceModule>({
      load: () => require("expo-device") as DeviceModule,
      moduleName: "expo-device",
    }) ?? fallbackDeviceModule
  );
}

/** Loaded on demand so this module keeps Sentry out of its import graph. */
function reportUnexpectedProbeFailure(error: unknown) {
  const { reportError } = require("@/infra/error/utils/report-error") as {
    reportError: typeof import("@/infra/error/utils/report-error").reportError;
  };

  reportError(error, {
    tags: { area: "native_modules", operation: "probe_expo_network" },
  });
}

/** Requiring a missing one twice breaks Metro. */
function hasNativeNetworkModule() {
  try {
    const { requireOptionalNativeModule } = require("expo-modules-core") as {
      requireOptionalNativeModule: (name: string) => unknown;
    };

    return Boolean(requireOptionalNativeModule("ExpoNetwork"));
  } catch (error) {
    reportUnexpectedProbeFailure(error);

    return false;
  }
}

/** Returns `expo-network` when the binary carries it, or an always-online fallback. */
export function getExpoNetworkModule(): NetworkModule {
  if (!hasNativeNetworkModule()) {
    warnMissingModule("expo-network");

    return fallbackNetworkModule;
  }

  return (
    requireOptionalModule<NetworkModule>({
      load: () => require("expo-network") as NetworkModule,
      moduleName: "expo-network",
    }) ?? fallbackNetworkModule
  );
}

/** Returns `expo-screen-orientation` when present, or a no-op fallback when unavailable. */
export function getExpoScreenOrientationModule() {
  return (
    requireOptionalModule<ScreenOrientationModule>({
      load: () => require("expo-screen-orientation") as ScreenOrientationModule,
      moduleName: "expo-screen-orientation",
    }) ?? fallbackScreenOrientationModule
  );
}

/** Returns `expo-secure-store` when present, or `null` so callers can provide a JS fallback. */
export function getExpoSecureStoreModule() {
  return requireOptionalModule<SecureStoreModule>({
    load: () => require("expo-secure-store") as SecureStoreModule,
    moduleName: "expo-secure-store",
  });
}
