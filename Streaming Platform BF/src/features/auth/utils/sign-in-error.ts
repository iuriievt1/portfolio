import { SynamediaGoApiError } from "@bfbs/common-sdk";

import { errorCodes } from "@/infra/error/error-codes";
import {
  isTimeoutError,
  isTransportError,
} from "@/infra/error/utils/classify-error";

/** Carries the classified code so the gate never re-derives it. */
export class SignInError extends Error {
  override readonly cause: unknown;
  readonly code: string;

  constructor({ cause, code }: { cause: unknown; code: string }) {
    super(`Sign-in failed with ${code}`);

    this.cause = cause;
    this.code = code;
    this.name = "SignInError";
  }
}

/** A failure the provider never answered is either the connection or us. */
function classifyLocally(error: unknown): string {
  return isTransportError(error) || isTimeoutError(error)
    ? errorCodes.offline
    : errorCodes.unexpected;
}

/** The provider normalises credential failures; anything else is classified locally. */
export function getSignInErrorCode(error: unknown): string {
  return error instanceof SynamediaGoApiError && error.code
    ? error.code
    : classifyLocally(error);
}

/** Every rejected sign-in shows something, even one that escaped classification. */
export function getSignInFailureCode(error: unknown): string {
  return error instanceof SignInError ? error.code : errorCodes.unexpected;
}
