import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import type { RecordVisibility } from "../../clinical-record/types/clinical-record.types"
import { cursorMomentOf, decodeMomentCursor, momentPageOf, olderThan } from "../../infra/utils/cursor-moment"
import type {
	AcquisitionRow,
	Assignment,
	DraftClosing,
	DraftPage,
	EncounterRecordCount,
	NewDraft,
	PagedAcquisitionRow,
} from "../types/acquisition.types"

const COLUMNS = [
	"id",
	"idempotency_key",
	"patient_id",
	"encounter_id",
	"finding_id",
	"kind",
	"state",
	"operator_user_id",
	"department_id",
	"configuration_version_id",
	"started_at",
	"closed_at",
	"file_count",
	"version",
	"updated_at",
] as const

// datovy-model.md 4, datovy-model.md 11
@Injectable()
export class AcquisitionDraftRepository {
	constructor(private readonly database: DatabaseService) {}

	async findByIdempotencyKey(sql: Executor, idempotencyKey: string): Promise<AcquisitionRow | undefined> {
		const [row] = await sql<AcquisitionRow[]>`
			SELECT ${sql(COLUMNS)} FROM acquisition WHERE idempotency_key = ${idempotencyKey}
		`
		return row
	}

	async findById(sql: Executor, id: string): Promise<AcquisitionRow | undefined> {
		const [row] = await sql<AcquisitionRow[]>`SELECT ${sql(COLUMNS)} FROM acquisition WHERE id = ${id}`
		return row
	}

	// CAP-021-R32
	async lockById(tx: postgres.TransactionSql, id: string): Promise<AcquisitionRow | undefined> {
		const [row] = await tx<AcquisitionRow[]>`SELECT ${tx(COLUMNS)} FROM acquisition WHERE id = ${id} FOR UPDATE`
		return row
	}

	// CAP-014-R07, CAP-014-R26, CAP-021-R32
	async reassign(tx: postgres.TransactionSql, id: string, assignment: Assignment, now: Date): Promise<AcquisitionRow> {
		const changes = tx`
			patient_id = ${assignment.patientId}, encounter_id = ${assignment.encounterId}, finding_id = ${assignment.findingId}
		`
		return await this.changeDraft(tx, id, changes, now)
	}

	// CAP-015-R30, CAP-021-R32
	async touch(tx: postgres.TransactionSql, id: string, findingId: string | null, now: Date): Promise<AcquisitionRow> {
		return await this.changeDraft(tx, id, tx`finding_id = ${findingId}`, now)
	}

	// CAP-021-R32, CAP-015-R35
	async bump(tx: postgres.TransactionSql, id: string, now: Date): Promise<AcquisitionRow> {
		return await this.changeDraft(tx, id, undefined, now)
	}

	// CAP-014-R14, CAP-021-R13, CAP-021-R25, CAP-021-R29, CAP-020-R19, datovy-model.md 4
	async close(tx: postgres.TransactionSql, id: string, closing: DraftClosing, now: Date): Promise<AcquisitionRow> {
		const changes = tx`
			state = ${ACQUISITION_STATE.RECEIVED}, closed_at = ${closing.closedAt}, file_count = ${closing.fileCount},
			closing_session_id = ${closing.closingSessionId}, closing_device_id = ${closing.closingDeviceId},
			closed_wound_type_code = (SELECT f.wound_type_code FROM finding f WHERE f.id = acquisition.finding_id),
			closed_wound_type_code_list_version = (
				SELECT f.wound_type_code_list_version FROM finding f WHERE f.id = acquisition.finding_id
			)
		`
		return await this.changeDraft(tx, id, changes, now)
	}

	// CAP-014-R29
	async countInEncounter(sql: Executor, encounterId: string): Promise<number> {
		const [row] = await sql<{ count: string }[]>`
			SELECT count(*)::text AS count FROM acquisition WHERE encounter_id = ${encounterId}
		`
		return Number(row?.count ?? 0)
	}

	// Q-150
	async hasClosed(sql: Executor, encounterId: string): Promise<boolean> {
		const [row] = await sql<{ present: boolean }[]>`
			SELECT EXISTS (
				SELECT 1 FROM acquisition WHERE encounter_id = ${encounterId} AND state <> ${ACQUISITION_STATE.DRAFT}
			) AS present
		`
		return row?.present === true
	}

	// Q-150, CAP-015-R17
	async lockDraftsInEncounter(tx: postgres.TransactionSql, encounterId: string): Promise<AcquisitionRow[]> {
		return await tx<AcquisitionRow[]>`
			SELECT ${tx(COLUMNS)} FROM acquisition
			WHERE encounter_id = ${encounterId} AND state = ${ACQUISITION_STATE.DRAFT}
			ORDER BY id
			FOR UPDATE
		`
	}

	// CAP-015-R17, datovy-model.md 4
	async deleteDrafts(tx: postgres.TransactionSql, ids: readonly string[]): Promise<void> {
		if (ids.length === 0) {
			return
		}
		await tx`DELETE FROM acquisition WHERE id IN ${tx([...ids])} AND state = ${ACQUISITION_STATE.DRAFT}`
	}

	// CAP-015-R30, CAP-014-R06
	async insert(tx: postgres.TransactionSql, draft: NewDraft): Promise<AcquisitionRow> {
		const [row] = await tx<AcquisitionRow[]>`
			INSERT INTO acquisition (
				id, idempotency_key, patient_id, encounter_id, kind, state, operator_user_id, operator_session_id,
				department_id, configuration_version_id, started_at
			) VALUES (
				${draft.id}, ${draft.idempotencyKey}, ${draft.patientId}, ${draft.encounterId}, ${draft.kind},
				${ACQUISITION_STATE.DRAFT}, ${draft.operatorUserId}, ${draft.operatorSessionId}, ${draft.departmentId ?? null},
				${draft.configurationVersionId}, ${draft.startedAt}
			)
			RETURNING ${tx(COLUMNS)}
		`
		if (row === undefined) {
			throw new Error("inserting a draft returned no row")
		}
		return row
	}

	// CAP-015-R18
	async countOwnDrafts(sql: Executor, operatorUserId: string): Promise<number> {
		const [row] = await sql<{ count: string }[]>`
			SELECT count(*)::text AS count FROM acquisition
			WHERE operator_user_id = ${operatorUserId} AND state = ${ACQUISITION_STATE.DRAFT}
		`
		return Number(row?.count ?? 0)
	}

	// CAP-015-R29
	async listOwnDrafts(operatorUserId: string, cursor: string | undefined, limit: number): Promise<DraftPage> {
		const sql = this.database.sql
		const rows = await sql<PagedAcquisitionRow[]>`
			SELECT ${sql(COLUMNS)}, ${cursorMomentOf(sql, sql`updated_at`)} AS cursor_moment FROM acquisition
			WHERE operator_user_id = ${operatorUserId} AND state = ${ACQUISITION_STATE.DRAFT}
				AND ${olderThan(sql, sql`updated_at, id`, decodeMomentCursor(cursor))}
			ORDER BY updated_at DESC, id DESC
			LIMIT ${limit + 1}
		`
		return momentPageOf(rows, limit, (row) => row.cursor_moment)
	}

	// CAP-014-R22, CAP-015-R17, CAP-020-R16
	async listVisibleInEncounter(
		encounterId: string,
		visibility: RecordVisibility,
		cursor: string | undefined,
		limit: number,
	): Promise<DraftPage> {
		const sql = this.database.sql
		const rows = await sql<PagedAcquisitionRow[]>`
			SELECT ${sql(COLUMNS)}, ${cursorMomentOf(sql, sql`updated_at`)} AS cursor_moment FROM acquisition
			WHERE encounter_id = ${encounterId} AND ${visibleTo(sql, visibility)}
				AND ${olderThan(sql, sql`updated_at, id`, decodeMomentCursor(cursor))}
			ORDER BY updated_at DESC, id DESC
			LIMIT ${limit + 1}
		`
		return momentPageOf(rows, limit, (row) => row.cursor_moment)
	}

	// CAP-014-R19, CAP-014-S24
	async visibleCounts(
		sql: Executor,
		encounterIds: readonly string[],
		visibility: RecordVisibility,
	): Promise<EncounterRecordCount[]> {
		if (encounterIds.length === 0) {
			return []
		}
		const rows = await sql<{ encounter_id: string; count: string }[]>`
			SELECT encounter_id, count(*)::text AS count FROM acquisition
			WHERE encounter_id IN ${sql([...encounterIds])} AND ${visibleTo(sql, visibility)}
			GROUP BY encounter_id
		`
		return rows.map((row) => ({ encounter_id: row.encounter_id, count: Number(row.count) }))
	}

	// CAP-020-S27, CAP-014-R19
	async closedInDepartment(
		sql: Executor,
		encounterIds: readonly string[],
		departmentId: string | undefined,
	): Promise<string[]> {
		if (encounterIds.length === 0) {
			return []
		}
		const rows = await sql<{ id: string }[]>`
			SELECT id FROM acquisition
			WHERE encounter_id IN ${sql([...encounterIds])} AND state <> ${ACQUISITION_STATE.DRAFT}
				AND department_id = ${departmentId ?? null}::uuid
		`
		return rows.map((row) => row.id)
	}

	// CAP-014-R20, CAP-014-S31, CAP-020-R16
	async countClosedVisible(
		sql: Executor,
		encounterId: string,
		closedAcquisitionIds: readonly string[],
	): Promise<number> {
		const [row] = await sql<{ count: string }[]>`
			SELECT count(*)::text AS count FROM acquisition
			WHERE encounter_id = ${encounterId} AND state <> ${ACQUISITION_STATE.DRAFT}
				AND id = ANY(${[...closedAcquisitionIds]}::uuid[])
		`
		return Number(row?.count ?? 0)
	}

	// CAP-012-R19
	async configurationVersionExists(sql: Executor, version: number): Promise<boolean> {
		const [row] = await sql<{ present: boolean }[]>`
			SELECT EXISTS (SELECT 1 FROM configuration_version WHERE id = ${version}) AS present
		`
		return row?.present === true
	}

	// CAP-014-R20, CAP-014-S34
	async hasDraft(sql: Executor, encounterId: string): Promise<boolean> {
		const [row] = await sql<{ present: boolean }[]>`
			SELECT EXISTS (
				SELECT 1 FROM acquisition WHERE encounter_id = ${encounterId} AND state = ${ACQUISITION_STATE.DRAFT}
			) AS present
		`
		return row?.present === true
	}

	// CAP-021-R32
	private async changeDraft(
		tx: postgres.TransactionSql,
		id: string,
		changes: postgres.PendingQuery<postgres.Row[]> | undefined,
		now: Date,
	): Promise<AcquisitionRow> {
		const [row] = await tx<AcquisitionRow[]>`
			UPDATE acquisition SET version = version + 1, updated_at = ${now}${changes === undefined ? tx`` : tx`, ${changes}`}
			WHERE id = ${id} AND state = ${ACQUISITION_STATE.DRAFT}
			RETURNING ${tx(COLUMNS)}
		`
		if (row === undefined) {
			throw new Error(`changing the draft ${id} returned no row`)
		}
		return row
	}
}

// CAP-015-R17, CAP-003-R01, datovy-model.md 2
// CAP-015-R17, CAP-015-R30, CAP-020-R16
function visibleTo(sql: Executor, visibility: RecordVisibility): postgres.PendingQuery<postgres.Row[]> {
	return sql`(
		(state = ${ACQUISITION_STATE.DRAFT} AND operator_user_id = ${visibility.userId})
		OR (state <> ${ACQUISITION_STATE.DRAFT} AND id = ANY(${[...visibility.closedAcquisitionIds]}::uuid[]))
	)`
}
