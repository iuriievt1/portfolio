import { ADMINISTRATION_ERROR_CODE, ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import { MonitoredDeliveryRepository } from "../repositories/monitored-delivery.repository"

// CAP-023-R26, CAP-023-S18, administration.yaml resumeDeliveryVerification ⚠ Q-104
@Injectable()
export class DeliveryVerificationResumptionService {
	constructor(
		private readonly database: DatabaseService,
		private readonly deliveries: MonitoredDeliveryRepository,
		private readonly alerts: AdministratorAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	async resume(deliveryId: string, instanceId: string, administrator: AdministrationSession): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const instance = await this.deliveries.lockedVerification(tx, deliveryId, instanceId)
			if (instance === undefined) {
				throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
			}
			if (instance.verification_on_hold_at === null) {
				throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.VERIFICATION_NOT_ON_HOLD)
			}
			await this.deliveries.resumeVerification(tx, instanceId)
			await this.alerts.resolveForInstance(tx, ADMINISTRATOR_ALERT_KIND.VERIFICATION_REJECTED, instanceId)
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.VERIFICATION_RESUMED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: administrator.userId,
				objectId: instanceId,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: {
					delivery_id: deliveryId,
					delivery_instance_id: instanceId,
					rejections_in_a_row: instance.verification_rejections,
					administrator_user_id: administrator.userId,
				},
			})
		})
	}
}
