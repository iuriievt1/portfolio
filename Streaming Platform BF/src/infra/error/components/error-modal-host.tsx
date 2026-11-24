import { Portal } from "@gorhom/portal";
import { usePathname } from "expo-router";

import { getErrorEntry } from "../error-catalogue";
import { dismissErrorModal, useErrorModalState } from "../error-modal-store";
import { useErrorAction } from "../hooks/use-error-action";
import { ErrorModal } from "./error-modal";

const PLAYER_PATH_PREFIX = "/player";

type ErrorModalHostProps = {
  /** Sends the reader back to sign-in when a dialog offers it. */
  onSignIn: () => void;
};

/** Hosts the dialog above the app. */
export function ErrorModalHost({ onSignIn }: ErrorModalHostProps) {
  const { code, onRetry } = useErrorModalState();
  const pathname = usePathname();

  const handleAction = useErrorAction({
    onCancel: dismissErrorModal,
    onRetry: onRetry
      ? () => {
          dismissErrorModal();
          onRetry();
        }
      : undefined,
    onSignIn: () => {
      dismissErrorModal();
      onSignIn();
    },
  });

  const isPlayerOpen = pathname.startsWith(PLAYER_PATH_PREFIX);

  if (!code || isPlayerOpen || getErrorEntry(code).presentation !== "modal") {
    return null;
  }

  return (
    <Portal>
      <ErrorModal code={code} onAction={handleAction} />
    </Portal>
  );
}
