import { errorCodes } from "./error-codes";
import { mapNetworkFailureToCode } from "./map-network-failure";
import { isContentUnavailableError } from "./utils/classify-error";

export function mapLoadErrorToCode(error: unknown): string {
  const networkFailureCode = mapNetworkFailureToCode(error);

  if (networkFailureCode) {
    return networkFailureCode;
  }

  if (isContentUnavailableError(error)) {
    return errorCodes.contentUnavailable;
  }

  return errorCodes.unexpected;
}
