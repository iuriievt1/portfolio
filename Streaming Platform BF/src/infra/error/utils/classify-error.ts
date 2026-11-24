function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const TRANSPORT_ERROR_TERMS = ["failed to fetch", "network", "offline"];
const TIMEOUT_ERROR_TERMS = ["timed out", "timeout"];
const TIMEOUT_STATUSES = [408, 504];
const RATE_LIMITED_STATUS = 429;
const SERVER_ERROR_STATUS = 500;
const GONE_STATUSES = [404, 410];

export function hasMatchingTerm(
  value: string | undefined,
  terms: string[],
): boolean {
  if (!value) {
    return false;
  }

  const normalisedValue = value.toLowerCase();
  return terms.some((term) => normalisedValue.includes(term));
}

/** Reads both the mapped provider error and a raw ky response. */
export function getErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const { response, status } = error;

  if (typeof status === "number") {
    return status;
  }

  if (isRecord(response) && typeof response.status === "number") {
    return response.status;
  }

  return undefined;
}

export function getErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const { code } = error;
  return typeof code === "string" ? code : undefined;
}

export function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (!isRecord(error)) {
    return undefined;
  }

  const message = error.message ?? error.description;
  return typeof message === "string" ? message : undefined;
}

export function getErrorDescription(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const { description } = error;
  return typeof description === "string" ? description : undefined;
}

function matchesErrorTerms(error: unknown, terms: string[]): boolean {
  return (
    hasMatchingTerm(getErrorCode(error), terms) ||
    hasMatchingTerm(getErrorMessage(error), terms)
  );
}

/** Never reached the service. */
export function isTransportError(error: unknown): boolean {
  if (!error || getErrorStatus(error) !== undefined) {
    return false;
  }

  return (
    error instanceof TypeError ||
    matchesErrorTerms(error, TRANSPORT_ERROR_TERMS)
  );
}

/** The service, or something in front of it, never answered in time. */
export function isTimeoutError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const status = getErrorStatus(error);

  if (status !== undefined) {
    return TIMEOUT_STATUSES.includes(status);
  }

  return matchesErrorTerms(error, TIMEOUT_ERROR_TERMS);
}

/** The service answered, but with a failure it may recover from. */
export function isServerUnavailableError(error: unknown): boolean {
  const status = getErrorStatus(error);

  if (status === undefined) {
    return false;
  }

  return status >= SERVER_ERROR_STATUS || status === RATE_LIMITED_STATUS;
}

/**
 * The answer did not come from the service: a proxy or captive portal that
 * serves its own page leaves the body unparsable.
 */
export function isUnreadableResponseError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

/** The service says it is gone. */
export function isContentUnavailableError(error: unknown): boolean {
  const status = getErrorStatus(error);

  return status !== undefined && GONE_STATUSES.includes(status);
}
