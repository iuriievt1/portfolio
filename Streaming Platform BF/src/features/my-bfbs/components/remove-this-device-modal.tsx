import { DeviceManager } from "@bfbs/common-sdk";
import { useRef, useState } from "react";
import { reportDeviceRemoved } from "@/features/auth/device-removed-store";
import { reportError } from "@/infra/error";
import { ConfirmModal } from "./confirm-modal";

type RemoveThisDeviceModalProps = {
  deviceId: string;
  onClose: () => void;
};

/** Asks before removing this device, then shows AUTH_020. */
export function RemoveThisDeviceModal({
  deviceId,
  onClose,
}: RemoveThisDeviceModalProps) {
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isPending, setIsPending] = useState(false);
  // Once removed, Yes never removes again, and Cancel stays off.
  const [isRemoved, setIsRemoved] = useState(false);
  // isPending updates a moment late, so this blocks a fast double tap.
  const isSubmittingRef = useRef(false);

  const stopWithError = (message: string) => {
    setErrorMessage(message);
    setIsPending(false);
    isSubmittingRef.current = false;
  };

  const confirm = async () => {
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsPending(true);
    setErrorMessage(undefined);

    if (!isRemoved) {
      try {
        await DeviceManager.removeDevice(deviceId);
      } catch (error) {
        reportError(error, {
          tags: { area: "my-bfbs", operation: "remove_current_device" },
        });
        stopWithError("We couldn't remove this device. Please try again.");
        return;
      }

      setIsRemoved(true);
    }

    // Same cleanup and AUTH_020 page as a remote removal.
    reportDeviceRemoved();
  };

  const cancel = () => {
    if (!(isSubmittingRef.current || isRemoved)) {
      onClose();
    }
  };

  return (
    <ConfirmModal
      announcement="Remove this device confirmation. Are you sure you want to remove this device?"
      cancelAccessibilityLabel="Cancel remove this device"
      confirmAccessibilityLabel="Confirm remove this device"
      errorMessage={errorMessage}
      isCancelDisabled={isRemoved}
      isPending={isPending}
      onCancel={cancel}
      onConfirm={() => void confirm()}
      testID="remove-this-device"
      title="Are you sure you want to remove this device?"
      visible
    />
  );
}
