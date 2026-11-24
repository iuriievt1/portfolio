import { ERROR_CODE, PERMANENT_REJECTIONS } from "@ansora/contracts"
import {
	NATIVE_ERROR_CODE,
	SERVER_FILE_STATUS,
	STORED_FILE_NOT_FOUND,
	UPLOAD_STAGE,
	type UploadResult,
} from "@ansora/core-mobile"
import { ApiProblemError, errorCodeOf, retryAfterMsOf } from "../../api/api-error"
import { HTTP_STATUS } from "../../api/http-status"

export const UPLOAD_OUTCOME = {
	RECEIVED: "received",
	REJECTED: "rejected",
	RETRY: "retry",
	LATE: "late",
	REVOKED: "revoked",
} as const

export type UploadOutcome =
	| { kind: typeof UPLOAD_OUTCOME.RECEIVED }
	| { kind: typeof UPLOAD_OUTCOME.REJECTED; code: string | null }
	| { kind: typeof UPLOAD_OUTCOME.RETRY; retryAfterMs: number | undefined }
	| { kind: typeof UPLOAD_OUTCOME.LATE }
	| { kind: typeof UPLOAD_OUTCOME.REVOKED }

type FailureOutcome = Exclude<UploadOutcome, { kind: typeof UPLOAD_OUTCOME.RECEIVED }>

export const REPLACEMENT_OUTCOME = {
	RETRY: "retry",
	EDIT_REFUSED: "edit_refused",
	REVOKED: "revoked",
} as const

export type ReplacementOutcome =
	| { kind: typeof REPLACEMENT_OUTCOME.RETRY; retryAfterMs: number | undefined }
	| { kind: typeof REPLACEMENT_OUTCOME.EDIT_REFUSED; code: string | null }
	| { kind: typeof REPLACEMENT_OUTCOME.REVOKED }

const RECEIVED: UploadOutcome = { kind: UPLOAD_OUTCOME.RECEIVED }
const REJECTED_ON_SERVER: FailureOutcome = { kind: UPLOAD_OUTCOME.REJECTED, code: null }
const LATE: FailureOutcome = { kind: UPLOAD_OUTCOME.LATE }
const REVOKED: FailureOutcome = { kind: UPLOAD_OUTCOME.REVOKED }

const SUCCESS_FIRST = 200
const SUCCESS_LAST = 299
const CLIENT_ERROR_FIRST = 400
const CLIENT_ERROR_LAST = 499

// CAP-019-R13, CAP-019-R18
const RETRY_DELAYS_MS = [2000, 5000, 10_000, 30_000] as const
const SLOWED_RETRY_DELAY_MS = 60_000

// NAB-207, NAB-209, CAP-019-R14, CAP-019-R19, CAP-019-R20, api/README.md 5
const REJECTED_FOR_GOOD: ReadonlySet<string> = new Set(PERMANENT_REJECTIONS)

// CAP-009-S05, Q-076
const UNREADABLE_FILE: ReadonlySet<string> = new Set([
	NATIVE_ERROR_CODE.FILE_KEY_INVALID,
	NATIVE_ERROR_CODE.FILE_UNAVAILABLE,
	STORED_FILE_NOT_FOUND,
])

// CAP-019-R13, CAP-012-R24, CAP-006-R21, CAP-021-R32, ADR-054, api/README.md 5
const PASSING: ReadonlySet<string> = new Set([
	ERROR_CODE.RETRY,
	ERROR_CODE.SIGN_IN_AGAIN,
	ERROR_CODE.DEVICE_UNKNOWN,
	ERROR_CODE.DEVICE_PENDING_APPROVAL,
	ERROR_CODE.DEVICE_BLOCKED,
	ERROR_CODE.APP_VERSION_UNSUPPORTED,
	ERROR_CODE.DOCUMENTATION_UNAVAILABLE,
	ERROR_CODE.ACQUISITION_VERSION_CONFLICT,
	ERROR_CODE.ACQUISITION_INCOMPLETE,
])

function retry(retryAfterMs: number | undefined): FailureOutcome {
	return { kind: UPLOAD_OUTCOME.RETRY, retryAfterMs }
}

function isSuccess(status: number): boolean {
	return status >= SUCCESS_FIRST && status <= SUCCESS_LAST
}

// CAP-019-R27, api/README.md 5
function outcomeOfStatus(status: number, code: string | null, retryAfterMs: number | undefined): FailureOutcome {
	const isClientError = status >= CLIENT_ERROR_FIRST && status <= CLIENT_ERROR_LAST
	const isPassing =
		status === HTTP_STATUS.UNAUTHORIZED ||
		status === HTTP_STATUS.REQUEST_TIMEOUT ||
		status === HTTP_STATUS.TOO_MANY_REQUESTS
	return isClientError && !isPassing ? { kind: UPLOAD_OUTCOME.REJECTED, code } : retry(retryAfterMs)
}

// NAB-207, NAB-209, NAB-503–505, CAP-007-R11, CAP-019-R14, CAP-019-R27, ADR-012
function outcomeOfProblem(status: number, code: string | null, retryAfterMs: number | undefined): FailureOutcome {
	if (code === ERROR_CODE.DEVICE_REVOKED) {
		return REVOKED
	}
	if (code === ERROR_CODE.ACQUISITION_CLOSED) {
		return LATE
	}
	if (code !== null && REJECTED_FOR_GOOD.has(code)) {
		return { kind: UPLOAD_OUTCOME.REJECTED, code }
	}
	if (code !== null && PASSING.has(code)) {
		return retry(retryAfterMs)
	}
	return outcomeOfStatus(status, code, retryAfterMs)
}

// ADR-014, CAP-015-R35, CAP-015-R36
export function receiptOutcomeOf(status: unknown): UploadOutcome {
	switch (status) {
		case SERVER_FILE_STATUS.RECEIVED:
			return RECEIVED
		case SERVER_FILE_STATUS.REJECTED:
			return REJECTED_ON_SERVER
		default:
			return retry(undefined)
	}
}

// ADR-015, CAP-019-R21, CAP-010-S06, CAP-019-R32
export function uploadOutcomeOf(result: Pick<UploadResult, "stage" | "status" | "body" | "failure">): UploadOutcome {
	if (result.failure !== null || result.status === null) {
		return retry(undefined)
	}
	if (!isSuccess(result.status)) {
		return outcomeOfProblem(result.status, problemCodeOf(result.body), undefined)
	}
	return result.stage === UPLOAD_STAGE.ANNOUNCEMENT ? receiptOutcomeOf(receiptStatusOf(result.body)) : RECEIVED
}

// CAP-009-S05, ADR-038, Q-076
export function isUnreadableFile(error: unknown): boolean {
	const code = errorCodeOf(error)
	return code !== undefined && UNREADABLE_FILE.has(code)
}

// CAP-009-S05, ADR-038, Q-076
export function isStorageKeyLost(error: unknown): boolean {
	return errorCodeOf(error) === NATIVE_ERROR_CODE.KEY_INVALIDATED
}

// NAB-207, NAB-209, CAP-002-R17
export function failureOutcomeOf(error: unknown): FailureOutcome {
	if (!(error instanceof ApiProblemError)) {
		return retry(undefined)
	}
	return outcomeOfProblem(error.status, error.code ?? null, retryAfterMsOf(error))
}

// CAP-015-R34, CAP-021-R32, E115
export function replacementOutcomeOf(error: unknown): ReplacementOutcome {
	if (errorCodeOf(error) === ERROR_CODE.ACQUISITION_VERSION_CONFLICT) {
		return { kind: REPLACEMENT_OUTCOME.EDIT_REFUSED, code: ERROR_CODE.ACQUISITION_VERSION_CONFLICT }
	}
	const outcome = failureOutcomeOf(error)
	switch (outcome.kind) {
		case UPLOAD_OUTCOME.RETRY:
			return { kind: REPLACEMENT_OUTCOME.RETRY, retryAfterMs: outcome.retryAfterMs }
		case UPLOAD_OUTCOME.REVOKED:
			return { kind: REPLACEMENT_OUTCOME.REVOKED }
		case UPLOAD_OUTCOME.REJECTED:
			return { kind: REPLACEMENT_OUTCOME.EDIT_REFUSED, code: outcome.code }
		case UPLOAD_OUTCOME.LATE:
			return { kind: REPLACEMENT_OUTCOME.EDIT_REFUSED, code: ERROR_CODE.ACQUISITION_CLOSED }
		default:
			return outcome satisfies never
	}
}

// CAP-019-R18, CAP-019-R25
export function startsSlowedRetry(attempt: number): boolean {
	return attempt === RETRY_DELAYS_MS.length
}

// CAP-019-R18, RFC 9110
export function retryDelayOf(attempt: number, retryAfterMs: number | undefined): number {
	return Math.max(RETRY_DELAYS_MS[attempt] ?? SLOWED_RETRY_DELAY_MS, retryAfterMs ?? 0)
}

function problemCodeOf(body: string | null): string | null {
	const problem = parsedBodyOf(body) as { code?: unknown } | undefined
	return typeof problem?.code === "string" ? problem.code : null
}

function receiptStatusOf(body: string | null): unknown {
	const receipt = parsedBodyOf(body) as { file?: { status?: unknown } } | undefined
	return receipt?.file?.status
}

function parsedBodyOf(body: string | null): unknown {
	if (body === null) {
		return undefined
	}
	try {
		return JSON.parse(body)
	} catch {
		return undefined
	}
}
