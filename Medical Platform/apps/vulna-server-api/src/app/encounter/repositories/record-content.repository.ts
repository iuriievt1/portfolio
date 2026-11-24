import { Injectable } from "@nestjs/common"
import type { Executor } from "../../../libs/database/database.service"
import type { RecordContentRow } from "../types/encounter.types"

// CAP-014-R22, CAP-015-R31, CAP-018-R15
@Injectable()
export class RecordContentRepository {
	async contentOf(sql: Executor, acquisitionIds: readonly string[]): Promise<RecordContentRow[]> {
		if (acquisitionIds.length === 0) {
			return []
		}
		return await sql<RecordContentRow[]>`
			SELECT acquisition.id AS acquisition_id,
				(finding.wound_type_code IS NOT NULL) AS has_wound_type,
				(assessment.healing_phase_code IS NOT NULL) AS has_healing_phase,
				(document.title_code IS NOT NULL OR document.title_text IS NOT NULL) AS has_document_title
			FROM acquisition
			LEFT JOIN finding ON finding.id = acquisition.finding_id
			LEFT JOIN assessment ON assessment.acquisition_id = acquisition.id
			LEFT JOIN document ON document.acquisition_id = acquisition.id
			WHERE acquisition.id IN ${sql([...acquisitionIds])}
		`
	}
}
