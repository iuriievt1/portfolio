import { ERROR_CODE } from "@ansora/contracts"
import { ApiProblemError } from "./api-error"
import { HTTP_STATUS } from "./http-status"

export const REMOTE_FAILURE = {
	NO_CONNECTION: "no_connection",
	SERVER_ERROR: "server_error",
	DOCUMENTATION_UNAVAILABLE: "documentation_unavailable",
	NOT_FOUND: "not_found",
} as const

export type RemoteFailure = (typeof REMOTE_FAILURE)[keyof typeof REMOTE_FAILURE]

// CAP-002-R17, ADR-054
export function remoteFailureOf(error: unknown): RemoteFailure {
	if (!(error instanceof ApiProblemError)) {
		return REMOTE_FAILURE.NO_CONNECTION
	}
	if (error.code === ERROR_CODE.DOCUMENTATION_UNAVAILABLE) {
		return REMOTE_FAILURE.DOCUMENTATION_UNAVAILABLE
	}
	return REMOTE_FAILURE.SERVER_ERROR
}

// CAP-020-S03, CAP-020-R16, E29
export function documentationFailureOf(error: unknown): RemoteFailure {
	if (isNotFound(error)) {
		return REMOTE_FAILURE.NOT_FOUND
	}
	return remoteFailureOf(error)
}

// CAP-020-R15
export function isNotFound(error: unknown): boolean {
	return (
		error instanceof ApiProblemError &&
		error.status === HTTP_STATUS.NOT_FOUND &&
		error.code === ERROR_CODE.RESOURCE_NOT_FOUND
	)
}

// E29
export function isRetryable(failure: RemoteFailure): boolean {
	return failure !== REMOTE_FAILURE.NOT_FOUND
}
