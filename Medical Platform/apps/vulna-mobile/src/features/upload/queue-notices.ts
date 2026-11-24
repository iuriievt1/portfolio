import {
	type BufferedFile,
	closureNoticeIdOf,
	fileNoticeIdOf,
	QUEUE_NOTICE,
	type QueuedClosure,
	type QueueNotice,
	type QueueNoticeKind,
	REJECTION,
	rejectionOf,
} from "@ansora/core-mobile"
import { markQueueChanged } from "./queue-changes"
import { recordKindOf } from "./record-kind"
import { queueNotices, storageLosses } from "./transfer-store"

export type ClosureFailure =
	| typeof QUEUE_NOTICE.CLOSURE_CHANGED
	| typeof QUEUE_NOTICE.CLOSURE_FILE_REJECTED
	| typeof QUEUE_NOTICE.CLOSURE_FILE_UNREADABLE
	| typeof QUEUE_NOTICE.CLOSURE_REFUSED

function fileNoticeOf(file: BufferedFile, kind: QueueNoticeKind, rejectionCode: string | null, now: Date): QueueNotice {
	return {
		id: fileNoticeIdOf(file.fileKey),
		kind,
		operatorUserId: file.operatorUserId,
		acquisitionId: file.acquisitionId,
		recordKind: recordKindOf(file.kind),
		capturedAt: file.capturedAt,
		rejectionCode,
		createdAt: now.toISOString(),
	}
}

// CAP-019-R25, CAP-019-R29, E114
export async function noteFailedClosure(closure: QueuedClosure, kind: ClosureFailure, now = new Date()): Promise<void> {
	await (await queueNotices()).put({
		id: closureNoticeIdOf(closure.acquisitionId),
		kind,
		operatorUserId: closure.operatorUserId,
		acquisitionId: closure.acquisitionId,
		recordKind: closure.recordKind,
		capturedAt: null,
		rejectionCode: null,
		createdAt: now.toISOString(),
	})
	markQueueChanged()
}

// CAP-019-R14, CAP-019-R25, CAP-019-R29, CAP-019-S10, CAP-019-S18, E27, E55, E113, E114
export async function noteRejectedFile(
	file: BufferedFile,
	code: string | null,
	withdrawnClosure: QueuedClosure | undefined,
	now = new Date(),
): Promise<void> {
	if (withdrawnClosure !== undefined && rejectionOf(code) === REJECTION.OPEN_RECORD) {
		await noteFileOfClosure(file, withdrawnClosure, QUEUE_NOTICE.CLOSURE_FILE_REJECTED, now)
		return
	}
	await (await queueNotices()).put(fileNoticeOf(file, QUEUE_NOTICE.FILE_REJECTED, code, now))
	markQueueChanged()
}

// CAP-009-S05, CAP-019-R25, CAP-019-R29, ADR-038, Q-076
export async function noteUnreadableFile(
	file: BufferedFile,
	withdrawnClosure: QueuedClosure | undefined,
	now = new Date(),
): Promise<void> {
	if (withdrawnClosure !== undefined) {
		await noteFileOfClosure(file, withdrawnClosure, QUEUE_NOTICE.CLOSURE_FILE_UNREADABLE, now)
		return
	}
	await (await queueNotices()).put(fileNoticeOf(file, QUEUE_NOTICE.FILE_UNREADABLE, null, now))
	markQueueChanged()
}

async function noteFileOfClosure(
	file: BufferedFile,
	closure: QueuedClosure,
	kind: ClosureFailure,
	now: Date,
): Promise<void> {
	await (await queueNotices()).remove(fileNoticeIdOf(file.fileKey))
	await noteFailedClosure(closure, kind, now)
}

// CAP-019-R18, CAP-019-R25, E55
export async function noteSlowedFile(file: BufferedFile, now = new Date()): Promise<void> {
	await (await queueNotices()).put(fileNoticeOf(file, QUEUE_NOTICE.FILE_SLOWED, null, now))
	markQueueChanged()
}

// CAP-019-R18, CAP-019-R24
export async function forgetFileNotice(fileKey: string): Promise<void> {
	await (await queueNotices()).remove(fileNoticeIdOf(fileKey))
	markQueueChanged()
}

// CAP-019-R25, CAP-019-R23
export async function noticesOf(operatorUserId: string): Promise<QueueNotice[]> {
	return await (await queueNotices()).listFor(operatorUserId)
}

// CAP-019-R25
export async function acknowledgeNotice(id: string): Promise<void> {
	await (await queueNotices()).remove(id)
	markQueueChanged()
}

// CAP-009-S05, ADR-038, Q-076
export async function unacknowledgedLossOf(userId: string): Promise<string | undefined> {
	return await (await storageLosses()).unacknowledgedFor(userId)
}

// CAP-009-S05, Q-076
export async function acknowledgeLoss(lostAt: string, userId: string): Promise<void> {
	await (await storageLosses()).acknowledge(lostAt, userId)
	markQueueChanged()
}
