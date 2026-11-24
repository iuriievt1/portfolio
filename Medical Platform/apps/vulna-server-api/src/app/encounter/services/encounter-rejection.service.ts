import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { userAuditEventOf } from "../../audit/utils/user-audit-event"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { CurrentSession } from "../../login/types/login.types"
import type { FoundPatient } from "../../registry/types/registry.types"
import { withPatientSubject } from "../../registry/utils/patient-view"
import type { RejectedEncounterAction } from "../exceptions/rejected-encounter-action.exception"

// CAP-025-R27, CAP-014-R21
@Injectable()
export class EncounterRejectionService {
	constructor(
		private readonly database: DatabaseService,
		private readonly audit: AuditRepository,
	) {}

	async problemOf(
		current: CurrentSession,
		patient: FoundPatient,
		rejection: RejectedEncounterAction,
	): Promise<ProblemException> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.audit.append(
				tx,
				userAuditEventOf(current, {
					eventType: AUDIT_EVENT_TYPE.ENCOUNTER_ACTION_REJECTED,
					objectId: rejection.encounter.id,
					outcome: AUDIT_OUTCOME.REJECTED,
					details: withPatientSubject(patient, {
						encounter_id: rejection.encounter.id,
						encounter_action: rejection.action,
						reason: rejection.code,
					}),
				}),
			)
		})
		return new ProblemException(HttpStatus.CONFLICT, rejection.code)
	}
}
