import { ACQUISITION_STATE, ENCOUNTER_STATUS } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import type { UnfinishedEncounterRow } from "../types/encounter.types"

// clinical-workflow.yaml listUnfinishedEncounters, CAP-014-R18, CAP-021-R13
@Injectable()
export class UnfinishedEncounterRepository {
	constructor(private readonly database: DatabaseService) {}

	async ownUnfinished(operatorUserId: string, limit: number): Promise<UnfinishedEncounterRow[]> {
		return await this.database.sql<UnfinishedEncounterRow[]>`
			SELECT own.encounter_id, max(own.closed_at) AS last_documented_at,
				array_agg(own.id::text ORDER BY own.closed_at DESC, own.id DESC) AS acquisition_ids
			FROM acquisition own
			JOIN encounter ON encounter.id = own.encounter_id
			WHERE own.operator_user_id = ${operatorUserId} AND own.closed_at IS NOT NULL
				AND encounter.status = ${ENCOUNTER_STATUS.IN_PROGRESS}
				AND NOT EXISTS (
					SELECT 1 FROM acquisition draft
					WHERE draft.encounter_id = own.encounter_id AND draft.operator_user_id = ${operatorUserId}
						AND draft.state = ${ACQUISITION_STATE.DRAFT}
				)
			GROUP BY own.encounter_id
			ORDER BY max(own.closed_at) DESC, own.encounter_id DESC
			LIMIT ${limit}
		`
	}
}
