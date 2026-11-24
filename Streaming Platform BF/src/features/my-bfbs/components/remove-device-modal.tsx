import { useRef } from "react";
import { useRemoveDevice } from "@/features/devices";
import { ConfirmModal } from "./confirm-modal";

type RemoveDeviceModalProps = {
  deviceId: string;
  onClose: () => void;
  onRemoved?: (() => void) | undefined;
};

// Asks before removing another device. If it fails, it stays open to try again or cancel.
export function RemoveDeviceModal({
  deviceId,
  onClose,
  onRemoved,
}: RemoveDeviceModalProps) {
  const remove = useRemoveDevice();
  // isPending updates a moment after mutate(), so this blocks a fast double tap.
  const isRemovingRef = useRef(false);

  const confirm = () => {
    if (isRemovingRef.current) {
      return;
    }

    isRemovingRef.current = true;
    remove.mutate(deviceId, {
      onSettled: () => {
        isRemovingRef.current = false;
      },
      onSuccess: () => {
        onClose();
        onRemoved?.();
      },
    });
  };

  const cancel = () => {
    if (!isRemovingRef.current) {
      onClose();
    }
  };

  return (
    <ConfirmModal
      announcement="Remove device confirmation. Are you sure you want to remove this device?"
      cancelAccessibilityLabel="Cancel remove device"
      confirmAccessibilityLabel="Confirm remove device"
      errorMessage={
        remove.isError
          ? "We couldn't remove this device. Please try again."
          : undefined
      }
      isPending={remove.isPending}
      onCancel={cancel}
      onConfirm={confirm}
      testID="remove-device"
      title="Are you sure you want to remove this device?"
      visible
    />
  );
}
