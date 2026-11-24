import { isDeviceOffline } from "./connectivity-store";
import { errorCodes } from "./error-codes";
import {
  isServerUnavailableError,
  isTimeoutError,
  isTransportError,
  isUnreadableResponseError,
} from "./utils/classify-error";

function getNetworkFailureCode(error: unknown): string | undefined {
  if (isTimeoutError(error)) {
    return errorCodes.timedOut;
  }

  if (
    isTransportError(error) ||
    isServerUnavailableError(error) ||
    isUnreadableResponseError(error)
  ) {
    return errorCodes.serverUnavailable;
  }

  return undefined;
}

/**
 * The code for a request that came back with no answer of its own, or nothing
 * when the failure was not a network one. A device with no connection owns the
 * offline code whichever way the request failed.
 */
export function mapNetworkFailureToCode(error: unknown): string | undefined {
  const code = getNetworkFailureCode(error);

  if (!code) {
    return undefined;
  }

  return isDeviceOffline() ? errorCodes.offline : code;
}
