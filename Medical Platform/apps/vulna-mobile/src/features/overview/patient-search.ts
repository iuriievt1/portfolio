import { ERROR_CODE, identifierSearchTextOf, PATIENT_SEARCH_QUERY_MIN_LENGTH } from "@ansora/contracts"
import { ApiProblemError } from "../../api/api-error"
import type { Patient, PatientSearchResult } from "../../api/patients"
import { type RemoteFailure, remoteFailureOf } from "../../api/remote-failure"
import { patientNumberOf } from "../patient/patient-identity"

export const SEARCH_STATE = {
	IDLE: "idle",
	TOO_SHORT: "too_short",
	FOUND: "found",
	NOT_FOUND: "not_found",
	TOO_BROAD: "too_broad",
	RATE_LIMITED: "rate_limited",
	FAILED: "failed",
} as const

export type SearchState =
	| { kind: typeof SEARCH_STATE.IDLE }
	| { kind: typeof SEARCH_STATE.TOO_SHORT }
	| { kind: typeof SEARCH_STATE.FOUND; patients: readonly Patient[] }
	| { kind: typeof SEARCH_STATE.NOT_FOUND }
	| { kind: typeof SEARCH_STATE.TOO_BROAD }
	| { kind: typeof SEARCH_STATE.RATE_LIMITED; retryAfterSeconds: number | undefined }
	| { kind: typeof SEARCH_STATE.FAILED; failure: RemoteFailure }

export interface FoundIdentifier {
	value: string
	issuer: string | undefined
}

// CAP-013-R17, CAP-013-S23
export function searchStateOfQuery(query: string): SearchState | undefined {
	const text = identifierSearchTextOf(query)
	if (text.length === 0) {
		return { kind: SEARCH_STATE.IDLE }
	}
	if (text.length < PATIENT_SEARCH_QUERY_MIN_LENGTH) {
		return { kind: SEARCH_STATE.TOO_SHORT }
	}
	return undefined
}

// CAP-013-R07, CAP-013-S22, CAP-013-S24
export function searchStateOfResult(result: PatientSearchResult): SearchState {
	return result.items.length === 0
		? { kind: SEARCH_STATE.NOT_FOUND }
		: { kind: SEARCH_STATE.FOUND, patients: result.items }
}

// CAP-013-R15, CAP-013-R17, CAP-013-S12, CAP-013-S23, CAP-013-S25
export function searchStateOfError(error: unknown): SearchState {
	if (error instanceof ApiProblemError) {
		switch (error.code) {
			case ERROR_CODE.SEARCH_QUERY_TOO_SHORT:
				return { kind: SEARCH_STATE.TOO_SHORT }
			case ERROR_CODE.SEARCH_TOO_BROAD:
				return { kind: SEARCH_STATE.TOO_BROAD }
			case ERROR_CODE.SEARCH_RATE_LIMITED:
				return { kind: SEARCH_STATE.RATE_LIMITED, retryAfterSeconds: error.retryAfterSeconds }
		}
	}
	return { kind: SEARCH_STATE.FAILED, failure: remoteFailureOf(error) }
}

// CAP-013-R09, CAP-013-R12, CHG-182
export function foundIdentifierOf(patient: Patient, system: string, query: string): FoundIdentifier {
	const text = identifierSearchTextOf(query)
	const found = patient.identifiers.find(
		(identifier) => identifier.system === system && identifierSearchTextOf(identifier.value).startsWith(text),
	)
	return found === undefined
		? { value: patientNumberOf(patient), issuer: undefined }
		: { value: found.value, issuer: found.issuer }
}
