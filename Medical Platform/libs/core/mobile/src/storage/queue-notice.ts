import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import type { SqlDatabase } from "./sql-database"
import { oneOf } from "./stored-value"

// CAP-019-R25, CAP-019-R18, CAP-019-R29, CAP-009-S05, E55, E114, Q-076
export const QUEUE_NOTICE = {
	FILE_REJECTED: "file_rejected",
	FILE_UNREADABLE: "file_unreadable",
	FILE_SLOWED: "file_slowed",
	CLOSURE_CHANGED: "closure_changed",
	CLOSURE_FILE_REJECTED: "closure_file_rejected",
	CLOSURE_FILE_UNREADABLE: "closure_file_unreadable",
	CLOSURE_REFUSED: "closure_refused",
} as const

export type QueueNoticeKind = (typeof QUEUE_NOTICE)[keyof typeof QUEUE_NOTICE]

export interface QueueNotice {
	id: string
	kind: QueueNoticeKind
	operatorUserId: string
	acquisitionId: string
	recordKind: AcquisitionKind
	capturedAt: string | null
	rejectionCode: string | null
	createdAt: string
}

export interface QueueNoticeRecords {
	put(notice: QueueNotice): Promise<void>
	listFor(operatorUserId: string): Promise<QueueNotice[]>
	remove(id: string): Promise<void>
}

// CAP-019-R25
export function fileNoticeIdOf(fileKey: string): string {
	return `file:${fileKey}`
}

// CAP-019-R29
export function closureNoticeIdOf(acquisitionId: string): string {
	return `closure:${acquisitionId}`
}

interface QueueNoticeRow {
	id: string
	kind: string
	operator_user_id: string
	acquisition_id: string
	record_kind: string
	captured_at: string | null
	rejection_code: string | null
	created_at: string
}

const COLUMNS = "id, kind, operator_user_id, acquisition_id, record_kind, captured_at, rejection_code, created_at"

const NOTICE_KINDS: readonly string[] = Object.values(QUEUE_NOTICE)
const RECORD_KINDS: readonly string[] = Object.values(ACQUISITION_KIND)

export class SqlQueueNoticeRecords implements QueueNoticeRecords {
	constructor(private readonly db: SqlDatabase) {}

	async put(notice: QueueNotice): Promise<void> {
		await this.db.runAsync(`INSERT OR REPLACE INTO queue_notice (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
			notice.id,
			notice.kind,
			notice.operatorUserId,
			notice.acquisitionId,
			notice.recordKind,
			notice.capturedAt,
			notice.rejectionCode,
			notice.createdAt,
		])
	}

	// CAP-019-R23, CAP-019-R25
	async listFor(operatorUserId: string): Promise<QueueNotice[]> {
		const rows = await this.db.getAllAsync<QueueNoticeRow>(
			`SELECT ${COLUMNS} FROM queue_notice WHERE operator_user_id = ? ORDER BY created_at, id`,
			[operatorUserId],
		)
		return rows.map(noticeOf)
	}

	async remove(id: string): Promise<void> {
		await this.db.runAsync("DELETE FROM queue_notice WHERE id = ?", [id])
	}
}

function noticeOf(row: QueueNoticeRow): QueueNotice {
	return {
		id: row.id,
		kind: oneOf<QueueNoticeKind>(NOTICE_KINDS, row.kind, QUEUE_NOTICE.CLOSURE_REFUSED),
		operatorUserId: row.operator_user_id,
		acquisitionId: row.acquisition_id,
		recordKind: oneOf<AcquisitionKind>(RECORD_KINDS, row.record_kind, ACQUISITION_KIND.PHOTO),
		capturedAt: row.captured_at,
		rejectionCode: row.rejection_code,
		createdAt: row.created_at,
	}
}
