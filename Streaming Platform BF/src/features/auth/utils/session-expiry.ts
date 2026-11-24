import { SynamediaGoApiError } from "@bfbs/common-sdk";

import { requestSignIn } from "../sign-in-request-store";

const SESSION_EXPIRED_ERROR_CODES = new Set(["AUTH_006", "AUTH_007"]);

/** Whether an SDK operation rejected because its authenticated session expired. */
export function isSessionExpiredError(error: unknown): boolean {
  return (
    typeof SynamediaGoApiError === "function" &&
    error instanceof SynamediaGoApiError &&
    error.code !== undefined &&
    SESSION_EXPIRED_ERROR_CODES.has(error.code)
  );
}

/** Returns an expired SDK session to sign-in and reports whether it handled the error. */
export function handleSessionExpiry(error: unknown): boolean {
  if (!isSessionExpiredError(error)) {
    return false;
  }

  requestSignIn();
  return true;
}
