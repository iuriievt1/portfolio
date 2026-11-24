import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Executor } from "../../../libs/database/database.service"
import type { AssessmentRow, StoredAssessment } from "../types/finding.types"

const COLUMNS = ["acquisition_id", "healing_phase_code", "code_list_version", "description"] as const

// CAP-017-R03, CAP-017-R04, CAP-017-R09, datovy-model.md 2
@Injectable()
export class AssessmentRepository {
	async findByAcquisition(sql: Executor, acquisitionId: string): Promise<AssessmentRow | undefined> {
		const [row] = await sql<AssessmentRow[]>`
			SELECT ${sql(COLUMNS)} FROM assessment WHERE acquisition_id = ${acquisitionId}
		`
		return row
	}

	async upsert(tx: postgres.TransactionSql, assessment: StoredAssessment, now: Date): Promise<void> {
		await tx`
			INSERT INTO assessment (acquisition_id, healing_phase_code, code_list_version, description, updated_at)
			VALUES (
				${assessment.acquisitionId}, ${assessment.healingPhaseCode}, ${assessment.codeListVersion},
				${assessment.description}, ${now}
			)
			ON CONFLICT (acquisition_id) DO UPDATE SET
				healing_phase_code = EXCLUDED.healing_phase_code,
				code_list_version = EXCLUDED.code_list_version,
				description = EXCLUDED.description,
				updated_at = EXCLUDED.updated_at
		`
	}

	// CAP-017-R04, CHG-181
	async remove(tx: postgres.TransactionSql, acquisitionId: string): Promise<void> {
		await tx`DELETE FROM assessment WHERE acquisition_id = ${acquisitionId}`
	}
}
