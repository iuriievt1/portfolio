import { mobileStorage } from "@/infra/common-sdk/utils/mobile-storage";

const PENDING_DEVICE_REGISTRATION_KEY = "bfbs.pending-device-registration";

/** AUTH_021: marks this device as not registered yet, so a restart asks to sign in again. */
export function setPendingDeviceRegistration() {
  mobileStorage.setItem(PENDING_DEVICE_REGISTRATION_KEY, "true");
}

/** Clears the AUTH_021 mark once this device is registered. */
export function clearPendingDeviceRegistration() {
  if (hasPendingDeviceRegistration()) {
    mobileStorage.removeItem(PENDING_DEVICE_REGISTRATION_KEY);
  }
}

/** Whether AUTH_021 was left before this device was registered. */
export function hasPendingDeviceRegistration() {
  return Boolean(mobileStorage.getItem(PENDING_DEVICE_REGISTRATION_KEY));
}
