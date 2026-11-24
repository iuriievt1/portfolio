import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import { FILE_STATUS } from "../../acquisition/constants/acquisition-file.constants"
import { cursorMomentOf, decodeMomentCursor, momentPageOf, newerThan } from "../../infra/utils/cursor-moment"
import type {
	FindingRow,
	NewFinding,
	TrackedFindingPage,
	TrackedFindingRow,
	VisibleFindings,
	WoundTypeChoice,
} from "../types/finding.types"

const COLUMNS = [
	"id",
	"patient_id",
	"department_id",
	"finding_key",
	"origin_acquisition_id",
	"created_by",
	"created_at",
	"wound_type_code",
	"wound_type_code_list_version",
	"wound_type_set_by",
] as const

// datovy-model.md 2, datovy-model.md 11, CAP-020-R13
@Injectable()
export class FindingRepository {
	constructor(private readonly database: DatabaseService) {}

	async insert(tx: postgres.TransactionSql, finding: NewFinding): Promise<FindingRow> {
		const [row] = await tx<FindingRow[]>`
			INSERT INTO finding (id, patient_id, department_id, finding_key, origin_acquisition_id, created_by)
			VALUES (
				${finding.id}, ${finding.patientId}, ${finding.departmentId}, ${finding.findingKey},
				${finding.originAcquisitionId}, ${finding.createdBy}
			)
			RETURNING ${tx(COLUMNS)}
		`
		if (row === undefined) {
			throw new Error(`inserting the finding ${finding.id} returned no row`)
		}
		return row
	}

	async findById(sql: Executor, id: string): Promise<FindingRow | undefined> {
		const [row] = await sql<FindingRow[]>`SELECT ${sql(COLUMNS)} FROM finding WHERE id = ${id}`
		return row
	}

	async findByKey(sql: Executor, findingKey: string): Promise<FindingRow | undefined> {
		const [row] = await sql<FindingRow[]>`SELECT ${sql(COLUMNS)} FROM finding WHERE finding_key = ${findingKey}`
		return row
	}

	// CAP-020-R13
	async newFindingOf(sql: Executor, acquisitionId: string): Promise<FindingRow | undefined> {
		const [row] = await sql<FindingRow[]>`
			SELECT ${sql(COLUMNS)} FROM finding WHERE origin_acquisition_id = ${acquisitionId}
		`
		return row
	}

	// CAP-020-R13, CAP-020-R20
	async hasClosedRecord(sql: Executor, findingId: string): Promise<boolean> {
		const [row] = await sql<{ present: boolean }[]>`
			SELECT EXISTS (
				SELECT 1 FROM acquisition WHERE finding_id = ${findingId} AND state <> ${ACQUISITION_STATE.DRAFT}
			) AS present
		`
		return row?.present === true
	}

	// CAP-017-R02, CAP-020-R19
	async setWoundType(tx: postgres.TransactionSql, findingId: string, choice: WoundTypeChoice): Promise<void> {
		await tx`
			UPDATE finding SET
				wound_type_code = ${choice.code},
				wound_type_code_list_version = ${choice.codeListVersion},
				wound_type_set_by = ${choice.setBy}
			WHERE id = ${findingId}
		`
	}

	// CAP-020-R13
	async detachFrom(tx: postgres.TransactionSql, acquisitionId: string, findingId: string): Promise<void> {
		await tx`UPDATE acquisition SET finding_id = NULL WHERE id = ${acquisitionId} AND finding_id = ${findingId}`
	}

	async delete(tx: postgres.TransactionSql, id: string): Promise<void> {
		await tx`DELETE FROM finding WHERE id = ${id}`
	}

	// CAP-021-R32, CAP-020-R21
	async lockById(tx: postgres.TransactionSql, id: string): Promise<FindingRow | undefined> {
		const [row] = await tx<FindingRow[]>`SELECT ${tx(COLUMNS)} FROM finding WHERE id = ${id} FOR UPDATE`
		return row
	}

	// CAP-016-R17, CAP-020-R04, CAP-020-R20, ADR-054 bod 2
	async listTracked(
		patientId: string,
		visible: VisibleFindings,
		cursor: string | undefined,
		limit: number,
	): Promise<TrackedFindingPage> {
		const sql = this.database.sql
		const rows = await sql<TrackedFindingRow[]>`
			${trackedSelect(sql, visibleRecordOf(sql, visible.acquisitionIds))}
			WHERE finding.patient_id = ${patientId} AND finding.id = ANY(${[...visible.findingIds]}::uuid[])
				AND ${newerThan(sql, sql`finding.created_at, finding.id`, decodeMomentCursor(cursor))}
			ORDER BY finding.created_at, finding.id
			LIMIT ${limit + 1}
		`
		return momentPageOf(rows, limit, (row) => row.cursor_moment)
	}

	// CAP-020-R21, CAP-020-R16, CAP-020-R20
	async trackedById(
		findingId: string,
		visibleAcquisitionIds: readonly string[],
	): Promise<TrackedFindingRow | undefined> {
		const sql = this.database.sql
		const [row] = await sql<TrackedFindingRow[]>`
			${trackedSelect(sql, visibleRecordOf(sql, visibleAcquisitionIds))}
			WHERE finding.id = ${findingId}
		`
		return row
	}
}

// ADR-054 bod 2, CAP-020-R16
function visibleRecordOf(sql: postgres.Sql, acquisitionIds: readonly string[]): postgres.PendingQuery<postgres.Row[]> {
	return sql`acquisition.id = ANY(${[...acquisitionIds]}::uuid[])`
}

// CAP-016-R17, CAP-020-R04, CAP-020-R20
function trackedSelect(
	sql: postgres.Sql,
	recordInScope: postgres.PendingQuery<postgres.Row[]>,
): postgres.PendingQuery<postgres.Row[]> {
	return sql`
		SELECT finding.id, finding.patient_id, finding.wound_number, finding.created_at, last.id AS last_acquisition_id,
			last.closed_at AS last_closed_at,
			${cursorMomentOf(sql, sql`finding.created_at`)} AS cursor_moment,
			finding.wound_type_code, finding.wound_type_code_list_version,
			body_site.region_code, body_site.laterality, body_site.view, body_site.x, body_site.y,
			body_site.body_diagram_version,
			assessment.healing_phase_code AS last_healing_phase_code,
			assessment.description AS last_description,
			assessment.code_list_version AS last_assessment_code_list_version,
			cover.id AS cover_image_id
		FROM finding
		JOIN LATERAL (
			SELECT acquisition.id, acquisition.closed_at FROM acquisition
			WHERE acquisition.finding_id = finding.id AND acquisition.state <> ${ACQUISITION_STATE.DRAFT}
				AND ${recordInScope}
			ORDER BY acquisition.closed_at DESC, acquisition.id DESC
			LIMIT 1
		) AS last ON TRUE
		LEFT JOIN body_site ON body_site.acquisition_id = last.id
		LEFT JOIN assessment ON assessment.acquisition_id = last.id
		LEFT JOIN LATERAL (
			SELECT image.id FROM image
			JOIN thumbnail ON thumbnail.image_id = image.id
			WHERE image.acquisition_id = last.id AND image.status = ${FILE_STATUS.RECEIVED}
			ORDER BY image.sequence
			LIMIT 1
		) AS cover ON TRUE
	`
}
