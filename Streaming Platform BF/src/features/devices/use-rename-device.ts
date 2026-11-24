import { DeviceManager } from "@bfbs/common-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reportError } from "@/infra/error";
import { DEVICES_QUERY_KEY } from "./use-devices";

// Saves a new name for this device. The SDK can only rename the current device.
export function useRenameDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      DeviceManager.updateCurrentDeviceSettings({ displayName: name.trim() }),
    onError: (error) => {
      reportError(error, {
        tags: { area: "my-bfbs", operation: "rename_device" },
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY }),
  });
}
