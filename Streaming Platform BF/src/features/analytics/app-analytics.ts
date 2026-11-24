import {
  DeviceClass,
  EventType,
  AppState as GoAppState,
} from "@bfbs/common-sdk";
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from "react-native";
import { hasStoredSynamediaAuthSession } from "@/features/auth/utils/synamedia-storage";
import { getGoAnalyticsApplicationMetadata } from "@/infra/common-sdk/configure-common-sdk";
import { reportError } from "@/infra/error/utils/report-error";
import { analyticsManager } from "./analytics-manager";
import { stopNetworkChanges, trackNetworkChanges } from "./network-analytics";

let hasTrackedAppStart = false;
let lastAppState: GoAppState | undefined;
let appStateSubscription: NativeEventSubscription | undefined;

// Runs one step. A failure is reported, so later steps still run.
function runSafely(operation: string, step: () => void) {
  try {
    step();
  } catch (error) {
    reportError(error, { tags: { area: "analytics", operation } });
  }
}

/** Sends APP_START, then fresh APP_DISCOVERY. Once per launch. */
export function trackAppStart() {
  if (hasTrackedAppStart) {
    return;
  }
  hasTrackedAppStart = true;

  runSafely("track_app_start", () =>
    analyticsManager.track({ type: EventType.APP_START, data: {} }),
  );
  runSafely("track_app_discovery", trackAppDiscovery);
  runSafely("track_network_changes", trackNetworkChanges);
  runSafely("track_app_state_changes", trackAppStateChanges);
}

/** Sends fresh discovery followed by APP_START after a successful sign-in. */
export function trackPostLoginAppStart() {
  runSafely("track_post_login_app_discovery", trackAppDiscovery);
  runSafely("track_post_login_app_start", () =>
    analyticsManager.track({ type: EventType.APP_START, data: {} }),
  );
}

// Maps the RN app state to the GO state. "inactive" is skipped.
function toGoAppState(state: AppStateStatus) {
  if (state === "active") {
    return GoAppState.FOREGROUND;
  }
  if (state === "background") {
    return GoAppState.BACKGROUND;
  }
  return undefined;
}

// Sends APP_STATE_CHANGE on background and foreground, and fresh APP_DISCOVERY on foreground.
function trackAppStateChanges() {
  lastAppState = toGoAppState(AppState.currentState);

  appStateSubscription = AppState.addEventListener("change", (nextState) => {
    const state = toGoAppState(nextState);
    if (!state || state === lastAppState) {
      return;
    }
    lastAppState = state;

    // Analytics must never crash the app.
    try {
      analyticsManager.track({
        type: EventType.APP_STATE_CHANGE,
        data: { state },
      });

      if (state === GoAppState.FOREGROUND) {
        trackAppDiscovery();
      }
    } catch (error) {
      reportError(error, {
        tags: { area: "analytics", operation: "track_app_state_change" },
      });
    }
  });
}

/** Removes the analytics listeners and resets state */
export function stopAppAnalytics() {
  appStateSubscription?.remove();
  appStateSubscription = undefined;
  stopNetworkChanges();
  hasTrackedAppStart = false;
  lastAppState = undefined;
}

/** Sends fresh app and device details. */
export function trackAppDiscovery() {
  const { appVersion, deviceName, deviceOs, uiLanguage } =
    getGoAnalyticsApplicationMetadata();

  analyticsManager.track({
    type: EventType.APP_DISCOVERY,
    data: {
      appVersion,
      deviceClass: DeviceClass.MOBILE,
      deviceInfo: { name: deviceName, os: deviceOs },
      isRegistered: hasStoredSynamediaAuthSession(),
      uiLanguage,
    },
  });
}
