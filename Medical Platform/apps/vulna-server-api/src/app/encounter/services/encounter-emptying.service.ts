import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { ENCOUNTER_STATUS, statusAfterEmptying } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AcquisitionDraftRepository } from "../../acquisition/repositories/acquisition-draft.repository"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { withPatientSubject } from "../../registry/utils/patient-view"
import { EncounterRepository } from "../repositories/encounter.repository"
import type { EmptyingAct, EncounterRow } from "../types/encounter.types"

// CAP-014-R18, CAP-014-R29, CAP-025-R29
@Injectable()
export class EncounterEmptyingService {
	constructor(
		private readonly encounters: EncounterRepository,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly audit: AuditRepository,
	) {}

	async emptyIfBare(tx: postgres.TransactionSql, locked: EncounterRow, now: Date): Promise<EncounterRow | undefined> {
		if (locked.status !== ENCOUNTER_STATUS.IN_PROGRESS) {
			return undefined
		}
		if ((await this.drafts.countInEncounter(tx, locked.id)) > 0) {
			return undefined
		}
		return await this.encounters.empty(tx, locked.id, statusAfterEmptying(locked.source), now)
	}

	async recordEmptied(
		tx: postgres.TransactionSql,
		previous: EncounterRow,
		emptied: EncounterRow,
		act: EmptyingAct,
	): Promise<void> {
		await this.audit.append(
			tx,
			act.actor({
				eventType: AUDIT_EVENT_TYPE.ENCOUNTER_EMPTIED,
				objectId: emptied.id,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: withPatientSubject(act.patient, {
					encounter_id: emptied.id,
					encounter_emptying: {
						previous_status: previous.status,
						new_status: emptied.status,
						emptied_by: act.emptiedBy,
					},
				}),
			}),
		)
	}
}
