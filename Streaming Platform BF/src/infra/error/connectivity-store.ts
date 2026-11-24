import { createStore } from "zustand";

type ConnectivityState = {
  isOffline: boolean;
};

const connectivityStore = createStore<ConnectivityState>(() => ({
  isOffline: false,
}));

export function setDeviceOffline(isOffline: boolean) {
  connectivityStore.setState({ isOffline });
}

/** The last reading, so the synchronous error mappers can consult it. */
export function isDeviceOffline() {
  return connectivityStore.getState().isOffline;
}
