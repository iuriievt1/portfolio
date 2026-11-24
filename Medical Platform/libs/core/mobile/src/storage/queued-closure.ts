import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import type { SqlDatabase } from "./sql-database"
import { oneOf } from "./stored-value"

// CAP-019-R10, CAP-019-R29, CAP-021-R32
export interface QueuedClosure {
	acquisitionId: string
	operatorUserId: string
	operatorPersonalNumber: string | null
	recordKind: AcquisitionKind
	fileKeys: readonly string[]
	contentFingerprint: string
	completedAt: string
}

export interface QueuedClosureRecords {
	put(closure: QueuedClosure): Promise<void>
	find(acquisitionId: string): Promise<QueuedClosure | undefined>
	list(): Promise<QueuedClosure[]>
	remove(acquisitionId: string): Promise<void>
}

interface QueuedClosureRow {
	acquisition_id: string
	operator_user_id: string
	operator_personal_number: string | null
	record_kind: string
	file_keys: string
	content_fingerprint: string
	completed_at: string
}

const COLUMNS =
	"acquisition_id, operator_user_id, operator_personal_number, record_kind, file_keys, content_fingerprint, completed_at"

const RECORD_KINDS: readonly string[] = Object.values(ACQUISITION_KIND)

export class SqlQueuedClosureRecords implements QueuedClosureRecords {
	constructor(private readonly db: SqlDatabase) {}

	// CAP-019-R29
	async put(closure: QueuedClosure): Promise<void> {
		await this.db.runAsync(`INSERT OR REPLACE INTO queued_closure (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
			closure.acquisitionId,
			closure.operatorUserId,
			closure.operatorPersonalNumber,
			closure.recordKind,
			JSON.stringify(closure.fileKeys),
			closure.contentFingerprint,
			closure.completedAt,
		])
	}

	async find(acquisitionId: string): Promise<QueuedClosure | undefined> {
		const row = await this.db.getFirstAsync<QueuedClosureRow>(
			`SELECT ${COLUMNS} FROM queued_closure WHERE acquisition_id = ?`,
			[acquisitionId],
		)
		return row === null ? undefined : closureOf(row)
	}

	async list(): Promise<QueuedClosure[]> {
		const rows = await this.db.getAllAsync<QueuedClosureRow>(
			`SELECT ${COLUMNS} FROM queued_closure ORDER BY completed_at`,
			[],
		)
		return rows.map(closureOf)
	}

	async remove(acquisitionId: string): Promise<void> {
		await this.db.runAsync("DELETE FROM queued_closure WHERE acquisition_id = ?", [acquisitionId])
	}
}

function isTextList(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function fileKeysOf(text: string): string[] {
	const parsed: unknown = JSON.parse(text)
	if (!isTextList(parsed)) {
		throw new Error("the queued closure carries file keys that are not a list of texts")
	}
	return parsed
}

function closureOf(row: QueuedClosureRow): QueuedClosure {
	return {
		acquisitionId: row.acquisition_id,
		operatorUserId: row.operator_user_id,
		operatorPersonalNumber: row.operator_personal_number,
		recordKind: oneOf<AcquisitionKind>(RECORD_KINDS, row.record_kind, ACQUISITION_KIND.PHOTO),
		fileKeys: fileKeysOf(row.file_keys),
		contentFingerprint: row.content_fingerprint,
		completedAt: row.completed_at,
	}
}
