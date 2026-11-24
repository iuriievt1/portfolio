import { EventType, NetworkState, NetworkType } from "@bfbs/common-sdk";
import { reportError } from "@/infra/error/utils/report-error";
import {
  getExpoNetworkModule,
  type NetworkStateSnapshot,
} from "@/utils/expo-native-modules";
import { analyticsManager } from "./analytics-manager";

// expo-network type → SDK type. Other types have no SDK value, so they are skipped.
const networkTypes: Partial<Record<string, NetworkType>> = {
  CELLULAR: NetworkType.CELLUAR, // SDK typo; the value is "CELLULAR".
  ETHERNET: NetworkType.WIRED,
  WIFI: NetworkType.WIFI,
};

let lastState: NetworkState | undefined;
let lastType: NetworkType | undefined;
let pendingEvent = Promise.resolve();
let networkSubscription: { remove: () => void } | undefined;

function toNetworkState({
  isConnected,
  isInternetReachable,
}: NetworkStateSnapshot) {
  if (!isConnected) {
    return NetworkState.DISCONNECT;
  }
  if (isInternetReachable === false) {
    return NetworkState.LOCAL_ONLY;
  }
  return NetworkState.CONNECT;
}

// expo-network only knows the Wi-Fi IP, so mobile data gets "0.0.0.0".
// "0.0.0.0" or an error is sent as "" so no IP is made up.
async function getIpAddress() {
  try {
    const ipAddress = await getExpoNetworkModule().getIpAddressAsync();
    return ipAddress === "0.0.0.0" ? "" : ipAddress;
  } catch (error) {
    reportError(error, {
      tags: { area: "analytics", operation: "get_ip_address" },
    });
    return "";
  }
}

async function trackNetworkState(snapshot: NetworkStateSnapshot) {
  const state = toNetworkState(snapshot);
  // On disconnect the device reports NONE, so send the network that was lost.
  const type =
    networkTypes[snapshot.type ?? ""] ??
    (state === NetworkState.DISCONNECT ? lastType : undefined);

  if (!type || (state === lastState && type === lastType)) {
    return;
  }

  const ipAddress =
    state === NetworkState.DISCONNECT ? "" : await getIpAddress();

  const hasActivePreviousNetwork =
    lastState === NetworkState.CONNECT || lastState === NetworkState.LOCAL_ONLY;
  if (hasActivePreviousNetwork && lastType && lastType !== type) {
    analyticsManager.track({
      type: EventType.NETWORK_CHANGE,
      data: {
        ipAddress: "",
        state: NetworkState.DISCONNECT,
        type: lastType,
      },
    });
  }

  analyticsManager.track({
    type: EventType.NETWORK_CHANGE,
    data: { ipAddress, state, type },
  });

  lastState = state;
  lastType = type;
}

// Runs one at a time so the IP lookup cannot reorder events.
// The catch keeps one failure from blocking later events.
function onNetworkState(snapshot: NetworkStateSnapshot) {
  pendingEvent = pendingEvent
    .then(() => trackNetworkState(snapshot))
    .catch((error: unknown) => {
      reportError(error, {
        tags: { area: "analytics", operation: "track_network_change" },
      });
    });
}

/** Sends the first NETWORK_CHANGE, then one for each real state or type change. */
export function trackNetworkChanges() {
  const network = getExpoNetworkModule();

  // Queue the first read before the listener, so a quick change can't be sent before it.
  pendingEvent = pendingEvent
    .then(() => network.getNetworkStateAsync())
    .then(trackNetworkState)
    .catch((error: unknown) => {
      reportError(error, {
        tags: { area: "analytics", operation: "track_initial_network_state" },
      });
    });

  networkSubscription = network.addNetworkStateListener(onNetworkState);
}

/** Removes the network listener and forgets the last state. */
export function stopNetworkChanges() {
  networkSubscription?.remove();
  networkSubscription = undefined;
  lastState = undefined;
  lastType = undefined;
}
