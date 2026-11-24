import { useEffect } from "react";
import { isAppUpdateRequired } from "@/infra/app-version/minimum-app-version";
import { errorCodes, showErrorModal } from "@/infra/error";

export function useAppUpdateError(isReady: boolean) {
  useEffect(() => {
    if (!(isReady && isAppUpdateRequired())) {
      return;
    }

    showErrorModal(errorCodes.updateRequired);
  }, [isReady]);
}
