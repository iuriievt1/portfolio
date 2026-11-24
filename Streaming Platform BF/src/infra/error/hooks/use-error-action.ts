import Constants from "expo-constants";
import { Platform } from "react-native";

import { openExternalUrl } from "@/utils/external-url";
import type { ErrorActionVerb } from "../error-catalogue";
import { reportError } from "../utils/report-error";

type ErrorActionHandlers = {
  onCancel?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  onSignIn?: (() => void) | undefined;
};

const STORE_TAGS = { area: "error", operation: "update_app" };

/** Falls back to the id we ship with when the listing id is not configured. */
function getStoreListingUrl() {
  if (Platform.OS === "ios") {
    const appStoreId = process.env.EXPO_PUBLIC_IOS_APP_STORE_ID;

    return appStoreId
      ? `https://apps.apple.com/app/id${appStoreId}`
      : undefined;
  }

  const applicationId =
    process.env.EXPO_PUBLIC_ANDROID_APP_ID ||
    Constants.expoConfig?.android?.package;

  return applicationId
    ? `https://play.google.com/store/apps/details?id=${applicationId}`
    : undefined;
}

function openStoreListing() {
  const url = getStoreListingUrl();

  if (!url) {
    reportError(new Error("Missing store listing url"), { tags: STORE_TAGS });

    return;
  }

  void openExternalUrl({ tags: STORE_TAGS, url });
}

/** Turns a verb into behaviour. */
export function useErrorAction({
  onCancel,
  onRetry,
  onSignIn,
}: ErrorActionHandlers) {
  return (verb: ErrorActionVerb) => {
    switch (verb) {
      case "refresh":
      case "retry":
        (onRetry ?? onCancel)?.();
        return;
      case "signIn":
        (onSignIn ?? onCancel)?.();
        return;
      case "updateApp":
        openStoreListing();
        return;
      default:
        onCancel?.();
    }
  };
}
