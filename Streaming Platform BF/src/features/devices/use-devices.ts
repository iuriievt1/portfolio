import { DeviceManager, type RegisteredDevice } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import { reportError } from "@/infra/error";
import { getOtherDevices } from "./device-list";

export const DEVICES_QUERY_KEY = ["devices"] as const;

/**
 * This device and the other devices registered to the household.
 * Sign-in already registers this device, so nothing is registered here.
 * In AUTH_021 this device isn't registered yet, so `current` is null.
 */
export type Devices = {
  current: RegisteredDevice | null;
  others: RegisteredDevice[];
};

/**
 * This device and the other devices registered to the household.
 * Sign-in already registers this device, so nothing is registered here.
 */
export function useDevices(isTooManyDevices = false) {
  return useQuery({
    queryFn: async (): Promise<Devices> => {
      try {
        // AUTH_021: only the quota list loads before this device is registered.
        if (isTooManyDevices) {
          const { devices } = await DeviceManager.getDeviceLimits();
          return { current: null, others: getOtherDevices(devices) };
        }

        const [current, devices] = await Promise.all([
          DeviceManager.getCurrentDevice(),
          DeviceManager.getDeviceList(),
        ]);

        return { current, others: getOtherDevices(devices, current.id) };
      } catch (error) {
        reportError(error, {
          tags: { area: "my-bfbs", operation: "get_devices" },
        });
        throw error;
      }
    },
    queryKey: isTooManyDevices
      ? [...DEVICES_QUERY_KEY, "too-many-devices"]
      : DEVICES_QUERY_KEY,
  });
}
