import { ACQUISITION_STATE_VALUE, ERROR_CODE } from "@ansora/contracts"
import {
	type BufferedFile,
	closureNoticeIdOf,
	NoSessionError,
	QUEUE_NOTICE,
	type QueuedClosure,
	type TransferBuffer,
} from "@ansora/core-mobile"
import { acquisitionApi } from "../../api/acquisitions"
import { ApiProblemError, errorCodeOf } from "../../api/api-error"
import { HTTP_STATUS } from "../../api/http-status"
import { signal } from "../../utils/signal"
import { sessionCaller } from "../session/session-actions"
import { currentSession } from "../session/session-store"
import { CLOSURE_CHECK, type ClosureCheck, closureCheckOf, closureOf } from "../summary/closing"
import { contentFingerprintOf } from "../summary/confirmed-content"
import { markQueueChanged } from "./queue-changes"
import { type ClosureFailure, noteFailedClosure } from "./queue-notices"
import { RetryTimers } from "./retry-timers"
import { queuedClosures, queueNotices } from "./transfer-store"
import { failureOutcomeOf, UPLOAD_OUTCOME } from "./upload-outcome"
import { awaitedFilesOf } from "./waiting-files"

const CLOSURE_OUTCOME = {
	DONE: "done",
	FAILED: "failed",
	RETRY: "retry",
	KEPT: "kept",
} as const

type ClosureOutcome =
	| { kind: typeof CLOSURE_OUTCOME.DONE }
	| { kind: typeof CLOSURE_OUTCOME.FAILED; failure: ClosureFailure }
	| { kind: typeof CLOSURE_OUTCOME.RETRY; retryAfterMs: number | undefined }
	| { kind: typeof CLOSURE_OUTCOME.KEPT }

const DONE: ClosureOutcome = { kind: CLOSURE_OUTCOME.DONE }
const KEPT: ClosureOutcome = { kind: CLOSURE_OUTCOME.KEPT }

const retries = new RetryTimers()
const closureSettled = signal()

function failed(failure: ClosureFailure): ClosureOutcome {
	return { kind: CLOSURE_OUTCOME.FAILED, failure }
}

function retry(retryAfterMs: number | undefined): ClosureOutcome {
	return { kind: CLOSURE_OUTCOME.RETRY, retryAfterMs }
}

// CAP-019-R28, CAP-019-S20
export const onQueuedClosureSettled = closureSettled.listen

// CAP-019-R29, CAP-019-R02, CAP-019-R10, E93
export async function queueClosure(closure: QueuedClosure): Promise<void> {
	await (await queuedClosures()).put(closure)
	await (await queueNotices()).remove(closureNoticeIdOf(closure.acquisitionId))
	retries.forget(closure.acquisitionId)
	markQueueChanged()
}

// CAP-019-R29, CAP-021-R32
export async function cancelQueuedClosure(acquisitionId: string): Promise<void> {
	try {
		const closures = await queuedClosures()
		if ((await closures.find(acquisitionId)) === undefined) {
			return
		}
		retries.forget(acquisitionId)
		await closures.remove(acquisitionId)
		markQueueChanged()
	} catch (failure) {
		console.warn(
			"the queued closure could not be cancelled; its check before sending finds the change",
			acquisitionId,
			failure,
		)
	}
}

// CAP-019-R29, CAP-002-R14, E9, E53, E91, E93, E103
export async function queuedClosureIdsOf(operatorUserId: string): Promise<ReadonlySet<string>> {
	const closures = await (await queuedClosures()).list()
	return new Set(
		closures.filter((closure) => closure.operatorUserId === operatorUserId).map((closure) => closure.acquisitionId),
	)
}

// CAP-019-R29, CAP-019-S21, E9
export async function isClosingQueuedFor(personalNumber: string): Promise<boolean> {
	const closures = await (await queuedClosures()).list()
	return closures.some((closure) => closure.operatorPersonalNumber === personalNumber)
}

let isSending = false
let isSendingAgainWanted = false

// CAP-019-R29, CAP-019-S20, CAP-019-S21, CAP-002-R09, CAP-021-R13
export async function sendQueuedClosures(buffer: TransferBuffer, wake: () => void): Promise<void> {
	if (isSending) {
		isSendingAgainWanted = true
		return
	}
	isSending = true
	try {
		do {
			isSendingAgainWanted = false
			await sendEachQueuedClosure(buffer, wake)
		} while (isSendingAgainWanted)
	} finally {
		isSending = false
	}
}

async function sendEachQueuedClosure(buffer: TransferBuffer, wake: () => void): Promise<void> {
	const operatorUserId = currentSession()?.user.id
	if (operatorUserId === undefined) {
		return
	}
	for (const closure of await (await queuedClosures()).list()) {
		if (closure.operatorUserId !== operatorUserId || retries.isResting(closure.acquisitionId)) {
			continue
		}
		const local = await buffer.photos(closure.acquisitionId, operatorUserId)
		if (isUploadingFor(closure, local)) {
			continue
		}
		await settle(closure, await attemptOrFailure(closure, local), wake)
	}
}

// CAP-019-R29
function isUploadingFor(closure: QueuedClosure, local: readonly BufferedFile[]): boolean {
	return awaitedFilesOf(closure.fileKeys, local).length > 0
}

async function attemptOrFailure(closure: QueuedClosure, local: readonly BufferedFile[]): Promise<ClosureOutcome> {
	try {
		return await attempt(closure, local)
	} catch (error) {
		console.warn("the queued closure was not sent", closure.acquisitionId, error)
		return outcomeOfFailure(error)
	}
}

// CAP-019-R29, CAP-021-R25, CAP-021-R32, CAP-021-R13, Q-076
async function attempt(closure: QueuedClosure, local: readonly BufferedFile[]): Promise<ClosureOutcome> {
	if (!isOwnerSignedIn(closure)) {
		return KEPT
	}
	const fresh = await sessionCaller.call((sessionToken) =>
		acquisitionApi.getAcquisitionDraft(sessionToken, closure.acquisitionId),
	)
	if (fresh.state === ACQUISITION_STATE_VALUE.RECEIVED) {
		return DONE
	}
	const check = closureCheckOf(closure, fresh, await contentFingerprintOf(fresh), local)
	if (check !== CLOSURE_CHECK.READY) {
		return outcomeOfCheck(check)
	}
	const operator = currentSession()
	if (operator?.user.id !== closure.operatorUserId) {
		return KEPT
	}
	const closing = closureOf(
		closure.fileKeys.length,
		{ userId: operator.user.id, sessionId: operator.session_id },
		new Date(closure.completedAt),
	)
	await sessionCaller.call((sessionToken) => acquisitionApi.closeAcquisition(sessionToken, fresh, closing))
	return DONE
}

// CAP-019-R29, CAP-002-R09, CAP-021-R13
function isOwnerSignedIn(closure: QueuedClosure): boolean {
	return currentSession()?.user.id === closure.operatorUserId
}

// CAP-019-R29, CAP-021-R25, CAP-021-R32, CAP-009-S05, E111, E112, E115, Q-076
function outcomeOfCheck(check: Exclude<ClosureCheck, typeof CLOSURE_CHECK.READY>): ClosureOutcome {
	switch (check) {
		case CLOSURE_CHECK.WAIT:
			return retry(undefined)
		case CLOSURE_CHECK.REJECTED:
			return failed(QUEUE_NOTICE.CLOSURE_FILE_REJECTED)
		case CLOSURE_CHECK.UNREADABLE:
			return failed(QUEUE_NOTICE.CLOSURE_FILE_UNREADABLE)
		case CLOSURE_CHECK.ON_OTHER_DEVICE:
		case CLOSURE_CHECK.CHANGED:
			return failed(QUEUE_NOTICE.CLOSURE_CHANGED)
		default:
			return check satisfies never
	}
}

// CAP-019-R13, CAP-019-R14, CAP-019-R27, CAP-019-S21, CAP-021-R32, E114, E129
function outcomeOfFailure(error: unknown): ClosureOutcome {
	if (error instanceof NoSessionError) {
		return KEPT
	}
	switch (errorCodeOf(error)) {
		case ERROR_CODE.SIGN_IN_AGAIN:
			return KEPT
		case ERROR_CODE.ACQUISITION_VERSION_CONFLICT:
			return failed(QUEUE_NOTICE.CLOSURE_CHANGED)
	}
	if (error instanceof ApiProblemError && error.status === HTTP_STATUS.UNAUTHORIZED) {
		return KEPT
	}
	const outcome = failureOutcomeOf(error)
	switch (outcome.kind) {
		case UPLOAD_OUTCOME.RETRY:
			return retry(outcome.retryAfterMs)
		case UPLOAD_OUTCOME.LATE:
			return DONE
		case UPLOAD_OUTCOME.REJECTED:
			return failed(QUEUE_NOTICE.CLOSURE_REFUSED)
		case UPLOAD_OUTCOME.REVOKED:
			return KEPT
		default:
			return outcome satisfies never
	}
}

// CAP-019-R29, CAP-021-R32
async function isStillQueued(closure: QueuedClosure): Promise<boolean> {
	const queued = await (await queuedClosures()).find(closure.acquisitionId)
	return queued?.completedAt === closure.completedAt && queued.contentFingerprint === closure.contentFingerprint
}

async function settle(closure: QueuedClosure, outcome: ClosureOutcome, wake: () => void): Promise<void> {
	switch (outcome.kind) {
		case CLOSURE_OUTCOME.DONE:
			if (await isStillQueued(closure)) {
				await remove(closure)
			}
			return
		case CLOSURE_OUTCOME.FAILED:
			if (await isStillQueued(closure)) {
				await remove(closure)
				await noteFailedClosure(closure, outcome.failure)
			}
			return
		case CLOSURE_OUTCOME.RETRY:
			retries.rest(closure.acquisitionId, outcome.retryAfterMs, wake)
			return
		case CLOSURE_OUTCOME.KEPT:
			return
		default:
			return outcome satisfies never
	}
}

// CAP-019-R29, CAP-009-S05, E114, Q-076
export async function withdrawQueuedClosure(acquisitionId: string): Promise<QueuedClosure | undefined> {
	const closure = await (await queuedClosures()).find(acquisitionId)
	if (closure !== undefined) {
		await remove(closure)
	}
	return closure
}

async function remove(closure: QueuedClosure): Promise<void> {
	retries.forget(closure.acquisitionId)
	await (await queuedClosures()).remove(closure.acquisitionId)
	markQueueChanged()
	closureSettled.emit()
}
