import type { AcquisitionKind } from "@ansora/contracts"
import { type BufferedFile, isFailed } from "@ansora/core-mobile"
import { recordKindOf } from "./record-kind"
import { isAwaitingServer } from "./waiting-files"

export interface QueuedRecord {
	acquisitionId: string
	operatorUserId: string
	kind: AcquisitionKind
	awaitingCount: number
	failedCount: number
	capturedAt: Date
}

export interface OthersQueue {
	recordCount: number
	failedRecordCount: number
}

export interface QueueView {
	own: QueuedRecord[]
	others: OthersQueue
}

// CAP-019-R08, CAP-019-R14, CAP-019-R23, CAP-019-R24, Q-076
export function queueViewOf(files: readonly BufferedFile[], userId: string): QueueView {
	const queued = queuedRecordsOf(files).filter((record) => record.awaitingCount > 0 || record.failedCount > 0)
	const others = queued.filter((record) => record.operatorUserId !== userId)
	return {
		own: queued
			.filter((record) => record.operatorUserId === userId)
			.sort((first, second) => first.capturedAt.getTime() - second.capturedAt.getTime()),
		others: {
			recordCount: others.length,
			failedRecordCount: others.filter((record) => record.failedCount > 0).length,
		},
	}
}

function queuedRecordsOf(files: readonly BufferedFile[]): QueuedRecord[] {
	const records = new Map<string, QueuedRecord>()
	for (const file of files) {
		records.set(file.acquisitionId, withFile(records.get(file.acquisitionId) ?? emptyRecordOf(file), file))
	}
	return [...records.values()]
}

function emptyRecordOf(file: BufferedFile): QueuedRecord {
	return {
		acquisitionId: file.acquisitionId,
		operatorUserId: file.operatorUserId,
		kind: recordKindOf(file.kind),
		awaitingCount: 0,
		failedCount: 0,
		capturedAt: new Date(file.capturedAt),
	}
}

function withFile(record: QueuedRecord, file: BufferedFile): QueuedRecord {
	const capturedAt = new Date(file.capturedAt)
	return {
		...record,
		awaitingCount: record.awaitingCount + (isAwaitingServer(file) ? 1 : 0),
		failedCount: record.failedCount + (isFailed(file) ? 1 : 0),
		capturedAt: capturedAt < record.capturedAt ? capturedAt : record.capturedAt,
	}
}
