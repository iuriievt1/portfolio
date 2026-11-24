import { ACQUISITION_KIND } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { cursorMomentOf, decodeMomentCursor, momentPageOf, olderThan } from "../../infra/utils/cursor-moment"
import type { PatientDocumentPage, PatientDocumentRow } from "../types/document.types"

// CAP-020-R18, CAP-020-R04, ADR-012, ADR-054 bod 2
@Injectable()
export class PatientDocumentRepository {
	constructor(private readonly database: DatabaseService) {}

	async listClosed(
		patientId: string,
		visibleAcquisitionIds: readonly string[],
		cursor: string | undefined,
		limit: number,
	): Promise<PatientDocumentPage> {
		const sql = this.database.sql
		const rows = await sql<PatientDocumentRow[]>`
			SELECT acquisition.id, acquisition.encounter_id, acquisition.closed_at, acquisition.file_count,
				${cursorMomentOf(sql, sql`acquisition.closed_at`)} AS cursor_moment,
				document.title_code, document.title_text, document.title_code_list_version
			FROM acquisition
			JOIN document ON document.acquisition_id = acquisition.id
			WHERE acquisition.patient_id = ${patientId} AND acquisition.kind = ${ACQUISITION_KIND.SCAN}
				AND acquisition.state <> ${ACQUISITION_STATE.DRAFT}
				AND acquisition.id = ANY(${[...visibleAcquisitionIds]}::uuid[])
				AND ${olderThan(sql, sql`acquisition.closed_at, acquisition.id`, decodeMomentCursor(cursor))}
			ORDER BY acquisition.closed_at DESC, acquisition.id DESC
			LIMIT ${limit + 1}
		`
		return momentPageOf(rows, limit, (row) => row.cursor_moment)
	}
}
