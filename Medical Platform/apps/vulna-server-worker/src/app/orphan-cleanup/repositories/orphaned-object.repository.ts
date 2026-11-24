import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { BINARY_OBJECT_REFERENCES, ORPHAN_CLEANUP_BATCH_SIZE } from "../constants/orphan-cleanup.constants"
import type { SetAsideObjectRow, UnrecordedBinary } from "../types/orphan-cleanup.types"

type Executor = postgres.Sql | postgres.TransactionSql
type Fragment = postgres.PendingQuery<postgres.Row[]>

// CAP-026-R14, datovy-model.md 4 „Binární objekt“
function unreferenced(sql: Executor, objectId: Fragment): Fragment {
	return BINARY_OBJECT_REFERENCES.map(
		(reference) =>
			sql`NOT EXISTS (
				SELECT 1 FROM ${sql(reference.table)} WHERE ${sql(reference.table)}.${sql(reference.column)} = ${objectId}
			)`,
	).reduce((conditions, condition) => sql`${conditions} AND ${condition}`)
}

// CAP-026-R14, CAP-026-S06, CAP-026-S07, dorucovaci-jadro.md 2, datovy-model.md 4 „Binární objekt“
@Injectable()
export class OrphanedObjectRepository {
	constructor(private readonly database: DatabaseService) {}

	async recordedKeys(keys: readonly string[]): Promise<Set<string>> {
		if (keys.length === 0) {
			return new Set()
		}
		const sql = this.database.sql
		const rows = await sql<{ id: string }[]>`SELECT id FROM binary_object WHERE id IN ${sql([...keys])}`
		return new Set(rows.map((row) => row.id))
	}

	// CAP-026-R14, CAP-026-S07, CAP-026-S11, datovy-model.md 4 „Binární objekt“
	async setAsideUnreferenced(tx: postgres.TransactionSql, cutoff: Date, now: Date): Promise<SetAsideObjectRow[]> {
		return await tx<SetAsideObjectRow[]>`
			UPDATE binary_object SET set_aside_at = ${now}
			WHERE id IN (
				SELECT candidate.id FROM binary_object candidate
				WHERE candidate.set_aside_at IS NULL
					AND candidate.buffer_deleted_at IS NULL
					AND candidate.clinical_record_binary_id IS NULL
					AND candidate.created_at <= ${cutoff}
					AND ${unreferenced(tx, tx`candidate.id`)}
				ORDER BY candidate.created_at
				LIMIT ${ORPHAN_CLEANUP_BATCH_SIZE}
				FOR UPDATE SKIP LOCKED
			)
			RETURNING id, size_bytes, created_at
		`
	}

	// CAP-026-R14, backend.md 2.1, dorucovaci-jadro.md 2
	async setAsideUnrecorded(
		tx: postgres.TransactionSql,
		binaries: readonly UnrecordedBinary[],
		now: Date,
	): Promise<SetAsideObjectRow[]> {
		const setAside: SetAsideObjectRow[] = []
		for (const binary of binaries) {
			const inserted = await tx<SetAsideObjectRow[]>`
				INSERT INTO binary_object (id, created_at, size_bytes, sha256, set_aside_at)
				VALUES (${binary.key}, ${binary.storedAt}, ${binary.sizeBytes}, ${binary.sha256}, ${now})
				ON CONFLICT (id) DO NOTHING
				RETURNING id, size_bytes, created_at
			`
			setAside.push(...inserted)
		}
		return setAside
	}
}
