import type { RegisteredDevice } from "@bfbs/common-sdk";
import { parseDateMs } from "@/utils/date-time";

/** Web player registrations come back as type "BROWSER". */
export function isBrowserDevice(device: RegisteredDevice) {
  return device.type === "BROWSER";
}

/** Phones and tablets register as type "COMPANION". */
export function isMobileDevice(device: RegisteredDevice) {
  return device.type === "COMPANION";
}

/** Every device except the current one, newest first. With no current id (AUTH_021), every device. */
export function getOtherDevices(
  devices: RegisteredDevice[],
  currentDeviceId?: string,
) {
  return devices
    .filter((device) => device.id !== currentDeviceId)
    .sort(
      (a, b) =>
        (parseDateMs(b.registeredDateTime) ?? 0) -
        (parseDateMs(a.registeredDateTime) ?? 0),
    );
}
