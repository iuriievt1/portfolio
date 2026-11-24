import { ConfirmModal } from "./components/confirm-modal";

type LogoutConfirmationModalProps = {
  errorMessage?: string | undefined;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
};

/** Confirms logout in a blocking, back-dismissible native dialog. */
export function LogoutConfirmationModal({
  errorMessage,
  isPending,
  onCancel,
  onConfirm,
  visible,
}: LogoutConfirmationModalProps) {
  return (
    <ConfirmModal
      announcement="Log out confirmation. Are you sure you want to log out of this device?"
      cancelAccessibilityLabel="Cancel log out"
      confirmAccessibilityLabel="Confirm log out"
      errorMessage={errorMessage}
      isPending={isPending}
      message="Are you sure you want to log out of this device?"
      onCancel={onCancel}
      onConfirm={onConfirm}
      pendingLabel="Logging Out…"
      testID="logout"
      title="Log Out"
      visible={visible}
    />
  );
}
