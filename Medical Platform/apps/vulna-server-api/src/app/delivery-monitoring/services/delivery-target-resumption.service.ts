import { ADMINISTRATION_ERROR_CODE, ADMINISTRATOR_ALERT_KIND, DELIVERY_TARGET_STATE } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import { MonitoredDeliveryRepository } from "../repositories/monitored-delivery.repository"

// CAP-023-R23, CAP-023-S10, CAP-023-S11, administration.yaml resumeDeliveryTarget
@Injectable()
export class DeliveryTargetResumptionService {
	constructor(
		private readonly database: DatabaseService,
		private readonly deliveries: MonitoredDeliveryRepository,
		private readonly alerts: AdministratorAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	async resume(targetCode: string, administrator: AdministrationSession): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const target = await this.deliveries.lockedTarget(tx, targetCode)
			if (target === undefined) {
				throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
			}
			if (target.state !== DELIVERY_TARGET_STATE.PAUSED) {
				throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.TARGET_NOT_PAUSED)
			}
			await this.deliveries.resumeTarget(tx, targetCode, administrator.userId)
			await this.alerts.resolveForTarget(tx, ADMINISTRATOR_ALERT_KIND.TARGET_PAUSED, targetCode)
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.TARGET_RESUMED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: administrator.userId,
				objectId: undefined,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: { target_code: targetCode, reason: target.reason, administrator_user_id: administrator.userId },
			})
		})
	}
}
