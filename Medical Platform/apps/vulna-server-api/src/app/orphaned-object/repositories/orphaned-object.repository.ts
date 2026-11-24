import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import {
	cursorMomentOf,
	decodeMomentCursor,
	type MomentPage,
	momentPageOf,
	newerThan,
} from "../../infra/utils/cursor-moment"
import { BINARY_OBJECT_REFERENCES } from "../constants/orphaned-object.constants"
import type { LockedObjectRow, OrphanedObjectQuery, OrphanedObjectRow } from "../types/orphaned-object.types"

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

// CAP-026-R14, CAP-026-S07, CAP-026-S08, datovy-model.md 4 „Binární objekt“
@Injectable()
export class OrphanedObjectRepository {
	constructor(private readonly database: DatabaseService) {}

	// administration.yaml listOrphanedObjects, ADR-012
	async page(query: OrphanedObjectQuery): Promise<MomentPage<OrphanedObjectRow>> {
		const sql = this.database.sql
		const rows = await sql<OrphanedObjectRow[]>`
			SELECT object.id, object.size_bytes, object.sha256, object.created_at, object.set_aside_at,
				${cursorMomentOf(sql, sql`object.created_at`)} AS cursor_moment
			FROM binary_object object
			WHERE object.set_aside_at IS NOT NULL
				AND ${unreferenced(sql, sql`object.id`)}
				AND ${newerThan(sql, sql`object.created_at, object.id`, decodeMomentCursor(query.cursor))}
			ORDER BY object.created_at, object.id
			LIMIT ${query.limit + 1}
		`
		return momentPageOf(rows, query.limit, (row) => row.cursor_moment)
	}

	// CAP-026-S08, datovy-model.md 4 „Binární objekt“
	async locked(tx: postgres.TransactionSql, objectId: string): Promise<LockedObjectRow | undefined> {
		const [row] = await tx<LockedObjectRow[]>`
			SELECT object.id, object.set_aside_at, ${unreferenced(tx, tx`object.id`)} AS is_unreferenced
			FROM binary_object object
			WHERE object.id = ${objectId}
			FOR UPDATE
		`
		return row
	}

	async delete(tx: postgres.TransactionSql, objectId: string): Promise<void> {
		await tx`DELETE FROM binary_object WHERE id = ${objectId}`
	}

	// CAP-026-R14, datovy-model.md 4 „Upozornění správce“
	async isAnySetAside(tx: postgres.TransactionSql): Promise<boolean> {
		const [row] = await tx<{ is_any: boolean }[]>`
			SELECT EXISTS (
				SELECT 1 FROM binary_object object
				WHERE object.set_aside_at IS NOT NULL AND ${unreferenced(tx, tx`object.id`)}
			) AS is_any
		`
		return row?.is_any === true
	}
}
