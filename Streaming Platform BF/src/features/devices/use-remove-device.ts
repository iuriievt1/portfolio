import { DeviceManager } from "@bfbs/common-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reportError } from "@/infra/error";
import { DEVICES_QUERY_KEY, type Devices } from "./use-devices";

// Removes another device from the household, which frees its slot for a new device.
export function useRemoveDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => DeviceManager.removeDevice(deviceId),
    onError: (error) => {
      reportError(error, {
        tags: { area: "my-bfbs", operation: "remove_device" },
      });
    },
    onSuccess: (_result, deviceId) => {
      // Take it off the list straight away, then reload the list.
      queryClient.setQueryData<Devices>(DEVICES_QUERY_KEY, (devices) => {
        if (!devices) {
          return devices;
        }

        return {
          ...devices,
          others: devices.others.filter((device) => device.id !== deviceId),
        };
      });
      void queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
    },
  });
}
