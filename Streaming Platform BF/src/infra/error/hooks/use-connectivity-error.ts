import { useEffect } from "react";
import type { NetworkStateSnapshot } from "@/utils/expo-native-modules";
import { getExpoNetworkModule } from "@/utils/expo-native-modules";
import { setDeviceOffline } from "../connectivity-store";
import { errorCodes } from "../error-codes";
import {
  dismissErrorModal,
  errorModalStore,
  showErrorModal,
} from "../error-modal-store";
import { reportError } from "../utils/report-error";

function isOffline({ isConnected, isInternetReachable }: NetworkStateSnapshot) {
  return isConnected === false || isInternetReachable === false;
}

function syncOfflineDialog(state: NetworkStateSnapshot) {
  setDeviceOffline(isOffline(state));

  if (isOffline(state)) {
    showErrorModal(errorCodes.offline);
    return;
  }

  if (errorModalStore.getState().code === errorCodes.offline) {
    dismissErrorModal();
  }
}

export function useConnectivityError() {
  useEffect(() => {
    const Network = getExpoNetworkModule();

    Network.getNetworkStateAsync()
      .then(syncOfflineDialog)
      .catch((error: unknown) => {
        reportError(error);
      });

    const subscription = Network.addNetworkStateListener(syncOfflineDialog);

    return () => {
      subscription.remove();
    };
  }, []);
}
