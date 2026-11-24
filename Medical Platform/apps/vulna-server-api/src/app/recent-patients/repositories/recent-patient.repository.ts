import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import type { LatestOwnRecordRow } from "../types/recent-patients.types"

// clinical-workflow.yaml listRecentPatients, CAP-021-R13, 0045-recent-patients.sql
@Injectable()
export class RecentPatientRepository {
	constructor(private readonly database: DatabaseService) {}

	async latestOwnRecordPerPatient(operatorUserId: string, limit: number): Promise<LatestOwnRecordRow[]> {
		return await this.database.sql<LatestOwnRecordRow[]>`
			SELECT latest.acquisition_id, latest.patient_id, latest.encounter_id, latest.closed_at
			FROM (
				SELECT DISTINCT ON (a.patient_id) a.id AS acquisition_id, a.patient_id, a.encounter_id, a.closed_at
				FROM acquisition a
				WHERE a.operator_user_id = ${operatorUserId} AND a.closed_at IS NOT NULL
				ORDER BY a.patient_id, a.closed_at DESC, a.id DESC
			) latest
			ORDER BY latest.closed_at DESC, latest.acquisition_id DESC
			LIMIT ${limit}
		`
	}
}
