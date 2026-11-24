import {
	CLINICAL_RECORD_FAILURE,
	type ClinicalRecordFailure,
	ClinicalRecordStoreError,
} from "@ansora/vulna-domain/ports"
import { getStatus, type MedplumClient, OperationOutcomeError } from "@medplum/core"

export const HTTP_CREATED = 201
export const HTTP_UNAUTHORIZED = 401
export const HTTP_FORBIDDEN = 403
export const HTTP_NOT_FOUND = 404
export const HTTP_GONE = 410
const HTTP_CONFLICT = 409
const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_SERVER_ERROR = 500

// ADR-050 bod 10, ADR-054 bod 5
const TRANSIENT_STATUSES = new Set([HTTP_UNAUTHORIZED, HTTP_CONFLICT, HTTP_TOO_MANY_REQUESTS])

// CAP-021-R27, dorucovaci-jadro.md 5
const TIMEOUT_ERROR_NAME = "TimeoutError"
const UNKNOWN_OUTCOME_CODES = new Set([
	"ECONNRESET",
	"EPIPE",
	"UND_ERR_SOCKET",
	"UND_ERR_HEADERS_TIMEOUT",
	"UND_ERR_BODY_TIMEOUT",
])

function causeCodeOf(error: Error): string | undefined {
	const cause: unknown = error.cause
	if (typeof cause !== "object" || cause === null || !("code" in cause)) {
		return undefined
	}
	return typeof cause.code === "string" ? cause.code : undefined
}

// CAP-021-R27, dorucovaci-jadro.md 5
function transportFailureOf(error: unknown): ClinicalRecordFailure {
	if (!(error instanceof Error)) {
		return CLINICAL_RECORD_FAILURE.UNAVAILABLE
	}
	const code = causeCodeOf(error)
	const isUnknown = error.name === TIMEOUT_ERROR_NAME || (code !== undefined && UNKNOWN_OUTCOME_CODES.has(code))
	return isUnknown ? CLINICAL_RECORD_FAILURE.UNKNOWN : CLINICAL_RECORD_FAILURE.UNAVAILABLE
}

// ADR-050 bod 10, ADR-054 bod 5
export function failureOfStatus(status: number): ClinicalRecordFailure {
	return status >= HTTP_SERVER_ERROR || TRANSIENT_STATUSES.has(status)
		? CLINICAL_RECORD_FAILURE.UNAVAILABLE
		: CLINICAL_RECORD_FAILURE.REJECTED
}

// ADR-050 bod 10
export async function failureOfResponse(
	response: Response,
	client: MedplumClient,
	operation: string,
): Promise<ClinicalRecordStoreError> {
	await response.body?.cancel()
	if (response.status === HTTP_UNAUTHORIZED) {
		client.clear()
	}
	return new ClinicalRecordStoreError(failureOfStatus(response.status), `${operation}: ${response.status}`)
}

export function storeErrorOf(error: unknown, operation: string): ClinicalRecordStoreError {
	if (error instanceof ClinicalRecordStoreError) {
		return error
	}
	if (!(error instanceof OperationOutcomeError)) {
		return new ClinicalRecordStoreError(transportFailureOf(error), `${operation}: ${String(error)}`)
	}
	const status = getStatus(error.outcome)
	return new ClinicalRecordStoreError(failureOfStatus(status), `${operation}: ${status} ${error.message}`)
}
