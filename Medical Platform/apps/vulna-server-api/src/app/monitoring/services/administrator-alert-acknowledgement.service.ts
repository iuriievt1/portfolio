import { ADMINISTRATION_ERROR_CODE, ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { AdministratorAlertRepository } from "../repositories/administrator-alert.repository"
import type { LockedAlert } from "../types/monitoring.types"

// CAP-023-R12, CHG-189, administration.yaml acknowledgeAdministratorAlert
@Injectable()
export class AdministratorAlertAcknowledgementService {
	constructor(
		private readonly database: DatabaseService,
		private readonly alerts: AdministratorAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	async acknowledge(alertId: string, administrator: AdministrationSession): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const alert = await this.alerts.locked(tx, alertId)
			if (alert === undefined) {
				throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
			}
			if (alert.kind !== ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING || alert.resolved_at !== null) {
				throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.ALERT_NOT_ACKNOWLEDGEABLE)
			}
			await this.alerts.acknowledge(tx, alertId, administrator.userId)
			await this.audit.append(tx, acknowledgementEvent(alertId, alert, administrator))
		})
	}
}

// CAP-025-R03, datovy-model.md 8
function acknowledgementEvent(
	alertId: string,
	alert: LockedAlert,
	administrator: AdministrationSession,
): NewAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_ACKNOWLEDGED,
		actorKind: AUDIT_ACTOR_KIND.USER,
		actorUserId: administrator.userId,
		objectId: alertId,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			alert_id: alertId,
			kind: alert.kind,
			delivery_id: alert.delivery_id,
			delivery_instance_id: alert.delivery_instance_id,
			administrator_user_id: administrator.userId,
		},
	}
}
