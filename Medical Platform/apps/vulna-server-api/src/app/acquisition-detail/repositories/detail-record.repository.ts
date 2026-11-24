import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import type { DetailRecordRow } from "../types/acquisition-detail.types"

// CAP-020-R17, CAP-020-R19, datovy-model.md 2
@Injectable()
export class DetailRecordRepository {
	constructor(private readonly database: DatabaseService) {}

	async findById(acquisitionId: string): Promise<DetailRecordRow | undefined> {
		const sql = this.database.sql
		const [row] = await sql<DetailRecordRow[]>`
			SELECT acquisition.id, acquisition.kind, acquisition.state, acquisition.operator_user_id,
				acquisition.department_id, acquisition.patient_id, acquisition.encounter_id, acquisition.finding_id,
				acquisition.closed_at, acquisition.closed_wound_type_code, acquisition.closed_wound_type_code_list_version,
				body_site.region_code, body_site.laterality, body_site.view, body_site.x, body_site.y,
				body_site.body_diagram_version,
				assessment.healing_phase_code, assessment.code_list_version AS assessment_code_list_version,
				assessment.description,
				document.title_code, document.title_text, document.title_code_list_version
			FROM acquisition
			LEFT JOIN body_site ON body_site.acquisition_id = acquisition.id
			LEFT JOIN assessment ON assessment.acquisition_id = acquisition.id
			LEFT JOIN document ON document.acquisition_id = acquisition.id
			WHERE acquisition.id = ${acquisitionId}
		`
		return row
	}
}
