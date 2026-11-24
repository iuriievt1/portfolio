import { createStore, useStore } from "zustand";

type DeviceRemovedState = { isRemoved: boolean };

/** Set when the SDK says this device was removed from the household. */
const deviceRemovedStore = createStore<DeviceRemovedState>(() => ({
  isRemoved: false,
}));

/** Asks the gate to end the session and show AUTH_020; false if already asked. */
export function reportDeviceRemoved() {
  if (deviceRemovedStore.getState().isRemoved) {
    return false;
  }

  deviceRemovedStore.setState({ isRemoved: true });
  return true;
}

/** Clears the flag when the reader presses Sign In on AUTH_020. */
export function clearDeviceRemoved() {
  deviceRemovedStore.setState({ isRemoved: false });
}

/** Whether the gate must run the removal cleanup. */
export function useIsDeviceRemoved() {
  return useStore(deviceRemovedStore, (state) => state.isRemoved);
}
