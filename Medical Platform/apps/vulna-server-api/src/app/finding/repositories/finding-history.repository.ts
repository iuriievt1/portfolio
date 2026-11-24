import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { cursorMomentOf, decodeMomentCursor, momentPageOf, olderThan } from "../../infra/utils/cursor-moment"
import type { TimelineRecordPage, TimelineRecordRow } from "../types/finding-history.types"

// CAP-020-R01, CAP-020-R04, CAP-020-R20, ADR-054 bod 2
@Injectable()
export class FindingHistoryRepository {
	constructor(private readonly database: DatabaseService) {}

	// CAP-020-R01, CAP-020-R19, CAP-020-R20, ADR-012
	async closedRecords(
		findingId: string,
		visibleAcquisitionIds: readonly string[],
		cursor: string | undefined,
		limit: number,
	): Promise<TimelineRecordPage> {
		const sql = this.database.sql
		const rows = await sql<TimelineRecordRow[]>`
			SELECT acquisition.id, acquisition.kind, acquisition.closed_at,
				${cursorMomentOf(sql, sql`acquisition.closed_at`)} AS cursor_moment,
				acquisition.closed_wound_type_code, acquisition.closed_wound_type_code_list_version,
				encounter.study_instance_uid, encounter.accession_number,
				body_site.region_code, body_site.laterality, body_site.view, body_site.x, body_site.y,
				body_site.body_diagram_version,
				assessment.healing_phase_code, assessment.code_list_version AS assessment_code_list_version,
				assessment.description
			FROM acquisition
			JOIN encounter ON encounter.id = acquisition.encounter_id
			LEFT JOIN body_site ON body_site.acquisition_id = acquisition.id
			LEFT JOIN assessment ON assessment.acquisition_id = acquisition.id
			WHERE acquisition.finding_id = ${findingId} AND acquisition.state <> ${ACQUISITION_STATE.DRAFT}
				AND acquisition.id = ANY(${[...visibleAcquisitionIds]}::uuid[])
				AND ${olderThan(sql, sql`acquisition.closed_at, acquisition.id`, decodeMomentCursor(cursor))}
			ORDER BY acquisition.closed_at DESC, acquisition.id DESC
			LIMIT ${limit + 1}
		`
		return momentPageOf(rows, limit, (row) => row.cursor_moment)
	}
}
