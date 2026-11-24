import { type EmptiedStatus, ENCOUNTER_SOURCE, ENCOUNTER_STATUS } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import { cursorMomentOf } from "../../infra/utils/cursor-moment"
import type {
	EncounterCursor,
	EncounterPage,
	EncounterRow,
	NewEncounter,
	PagedEncounterRow,
} from "../types/encounter.types"
import { decodeEncounterCursor, encodeEncounterCursor } from "../utils/encounter-cursor"

const OPEN_STATUSES = [ENCOUNTER_STATUS.PLANNED, ENCOUNTER_STATUS.IN_PROGRESS]

function selectColumns(sql: Executor): postgres.PendingQuery<postgres.Row[]> {
	return sql`id, patient_id, source, status, date::text AS date, scheduled_time::text AS scheduled_time, department_id,
		started_at, encounter_key, completed_at, completed_by, study_instance_uid, accession_number, status_changed_at,
		created_at`
}

// datovy-model.md 2, datovy-model.md 4
@Injectable()
export class EncounterRepository {
	constructor(private readonly database: DatabaseService) {}

	async findById(sql: Executor, id: string): Promise<EncounterRow | undefined> {
		const [row] = await sql<EncounterRow[]>`SELECT ${selectColumns(sql)} FROM encounter WHERE id = ${id}`
		return row
	}

	// CAP-020-R17, CAP-020-R18
	async findByIds(sql: Executor, ids: readonly string[]): Promise<EncounterRow[]> {
		if (ids.length === 0) {
			return []
		}
		return await sql<EncounterRow[]>`SELECT ${selectColumns(sql)} FROM encounter WHERE id IN ${sql([...ids])}`
	}

	// datovy-model.md 4
	async lockById(tx: postgres.TransactionSql, id: string): Promise<EncounterRow | undefined> {
		const [row] = await tx<EncounterRow[]>`SELECT ${selectColumns(tx)} FROM encounter WHERE id = ${id} FOR UPDATE`
		return row
	}

	// datovy-model.md 4
	async lockByIds(tx: postgres.TransactionSql, ids: readonly string[]): Promise<EncounterRow[]> {
		return await tx<EncounterRow[]>`
			SELECT ${selectColumns(tx)} FROM encounter WHERE id IN ${tx([...ids])} ORDER BY id FOR UPDATE
		`
	}

	// CAP-014-R06
	async lockByKey(tx: postgres.TransactionSql, encounterKey: string): Promise<EncounterRow | undefined> {
		const [row] = await tx<EncounterRow[]>`
			SELECT ${selectColumns(tx)} FROM encounter WHERE encounter_key = ${encounterKey} FOR UPDATE
		`
		return row
	}

	// CAP-014-R03, CAP-014-R06, NAB-370
	async insertCreatedInApp(tx: postgres.TransactionSql, encounter: NewEncounter): Promise<EncounterRow> {
		const [row] = await tx<EncounterRow[]>`
			INSERT INTO encounter (
				id, patient_id, source, status, date, department_id, started_at, encounter_key, study_instance_uid,
				status_changed_at
			) VALUES (
				${encounter.id}, ${encounter.patientId}, ${ENCOUNTER_SOURCE.CREATED_IN_APP}, ${ENCOUNTER_STATUS.IN_PROGRESS},
				${encounter.date}::date, ${encounter.departmentId ?? null}, ${encounter.startedAt}, ${encounter.encounterKey},
				${encounter.studyInstanceUid}, ${encounter.startedAt}
			)
			RETURNING ${selectColumns(tx)}
		`
		if (row === undefined) {
			throw new Error("inserting a visit returned no row")
		}
		return row
	}

	// CAP-014-R18
	async start(tx: postgres.TransactionSql, id: string, now: Date): Promise<EncounterRow> {
		const [row] = await tx<EncounterRow[]>`
			UPDATE encounter
			SET status = ${ENCOUNTER_STATUS.IN_PROGRESS}, started_at = COALESCE(started_at, ${now}),
				status_changed_at = ${now}, updated_at = ${now}
			WHERE id = ${id}
			RETURNING ${selectColumns(tx)}
		`
		if (row === undefined) {
			throw new Error(`starting the visit ${id} returned no row`)
		}
		return row
	}

	// CAP-014-R20
	async complete(tx: postgres.TransactionSql, id: string, userId: string, now: Date): Promise<EncounterRow> {
		const [row] = await tx<EncounterRow[]>`
			UPDATE encounter
			SET status = ${ENCOUNTER_STATUS.COMPLETED}, completed_at = ${now}, completed_by = ${userId},
				status_changed_at = ${now}, updated_at = ${now}
			WHERE id = ${id}
			RETURNING ${selectColumns(tx)}
		`
		if (row === undefined) {
			throw new Error(`completing the visit ${id} returned no row`)
		}
		return row
	}

	// CAP-014-R18, CAP-014-R29
	async empty(tx: postgres.TransactionSql, id: string, status: EmptiedStatus, now: Date): Promise<EncounterRow> {
		const [row] = await tx<EncounterRow[]>`
			UPDATE encounter
			SET status = ${status}, started_at = ${status === ENCOUNTER_STATUS.PLANNED ? tx`NULL` : tx`started_at`},
				status_changed_at = ${now}, updated_at = ${now}
			WHERE id = ${id} AND status = ${ENCOUNTER_STATUS.IN_PROGRESS}
			RETURNING ${selectColumns(tx)}
		`
		if (row === undefined) {
			throw new Error(`emptying the visit ${id} returned no row`)
		}
		return row
	}

	// CAP-014-R12, CAP-014-R19, CAP-014-R21
	async listOpenOnDay(
		patientId: string,
		date: string,
		cursor: string | undefined,
		limit: number,
	): Promise<EncounterPage> {
		const sql = this.database.sql
		const rows = await sql<PagedEncounterRow[]>`
			SELECT ${selectColumns(sql)}, ${cursorMomentColumn(sql)} FROM encounter
			WHERE patient_id = ${patientId} AND date = ${date}::date AND status IN ${sql(OPEN_STATUSES)}
				AND ${olderVisitsThan(sql, decodeEncounterCursor(cursor))}
			ORDER BY date DESC, COALESCE(started_at, created_at) DESC, id DESC
			LIMIT ${limit + 1}
		`
		return pageOf(rows, limit)
	}

	// CAP-014-R24, CAP-014-R29
	async listAllDays(patientId: string, cursor: string | undefined, limit: number): Promise<EncounterPage> {
		const sql = this.database.sql
		const rows = await sql<PagedEncounterRow[]>`
			SELECT ${selectColumns(sql)}, ${cursorMomentColumn(sql)} FROM encounter
			WHERE patient_id = ${patientId} AND status <> ${ENCOUNTER_STATUS.CANCELLED}
				AND ${olderVisitsThan(sql, decodeEncounterCursor(cursor))}
			ORDER BY date DESC, COALESCE(started_at, created_at) DESC, id DESC
			LIMIT ${limit + 1}
		`
		return pageOf(rows, limit)
	}

	// CAP-014-R16, CAP-003-R01, CHG-176
	async listScheduled(date: string, departmentId: string, limit: number): Promise<EncounterRow[]> {
		const sql = this.database.sql
		return await sql<EncounterRow[]>`
			SELECT ${selectColumns(sql)} FROM encounter e
			WHERE e.source = ${ENCOUNTER_SOURCE.WORKLIST} AND e.date = ${date}::date
				AND e.status IN ${sql(OPEN_STATUSES)} AND e.department_id = ${departmentId}
			ORDER BY e.scheduled_time ASC NULLS LAST,
				(
					SELECT i.value FROM patient_identifier i
					WHERE i.patient_id = e.patient_id AND i.valid_until IS NULL
					ORDER BY i.created_at, i.id
					LIMIT 1
				) ASC,
				e.id ASC
			LIMIT ${limit}
		`
	}
}

// CAP-014-R24
function cursorMomentColumn(sql: postgres.Sql): postgres.PendingQuery<postgres.Row[]> {
	return sql`${cursorMomentOf(sql, sql`COALESCE(started_at, created_at)`)} AS cursor_moment`
}

function olderVisitsThan(
	sql: postgres.Sql,
	cursor: EncounterCursor | undefined,
): postgres.PendingQuery<postgres.Row[]> {
	if (cursor === undefined) {
		return sql`TRUE`
	}
	return sql`(date, COALESCE(started_at, created_at), id) < (${cursor.date}::date, ${cursor.moment}::text::timestamptz, ${cursor.id}::uuid)`
}

function pageOf(rows: readonly PagedEncounterRow[], limit: number): EncounterPage {
	const page = rows.slice(0, limit)
	const last = page.at(-1)
	const hasMore = rows.length > limit && last !== undefined
	return {
		rows: page,
		nextCursor: hasMore ? encodeEncounterCursor(last) : null,
	}
}
