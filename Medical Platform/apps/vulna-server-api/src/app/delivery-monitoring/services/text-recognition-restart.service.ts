import { ADMINISTRATION_ERROR_CODE, ADMINISTRATOR_ALERT_KIND, hasTextRecognitionFailed } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AssemblyTaskRepository } from "../../acquisition/repositories/assembly-task.repository"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import type { TextRecognitionRestartInput } from "../dto/text-recognition-restart.input.dto"
import { MonitoredDeliveryRepository } from "../repositories/monitored-delivery.repository"
import type { DeliveryView, RecognitionRestart } from "../types/delivery-monitoring.types"
import { DeliveryOverviewService } from "./delivery-overview.service"

// CAP-022-R15, CAP-022-S06, administration.yaml restartTextRecognition, datovy-model.md 4 „Doručení“
@Injectable()
export class TextRecognitionRestartService {
	constructor(
		private readonly database: DatabaseService,
		private readonly deliveries: MonitoredDeliveryRepository,
		private readonly assemblies: AssemblyTaskRepository,
		private readonly overview: DeliveryOverviewService,
		private readonly alerts: AdministratorAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	async restart(
		deliveryId: string,
		input: TextRecognitionRestartInput,
		administrator: AdministrationSession,
	): Promise<DeliveryView> {
		return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const delivery = await this.deliveries.lockedDelivery(tx, deliveryId)
			if (delivery === undefined) {
				throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
			}
			if (!hasTextRecognitionFailed(delivery.state, delivery.reason)) {
				throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.TEXT_RECOGNITION_NOT_FAILED)
			}
			const restart: RecognitionRestart = {
				deliveryId,
				acquisitionId: delivery.acquisition_id,
				reason: input.reason,
				administratorUserId: administrator.userId,
			}
			await this.deliveries.restartAssembly(tx, restart.deliveryId)
			await this.deliveries.resetTextRecognition(tx, restart.acquisitionId)
			await this.requeueAssembly(tx, restart.acquisitionId)
			await this.deliveries.lockRecord(tx, restart.acquisitionId)
			await this.deliveries.refreshAcquisitionState(tx, restart.acquisitionId)
			await this.alerts.resolveForDelivery(tx, ADMINISTRATOR_ALERT_KIND.ASSEMBLY_FAILED, restart.deliveryId)
			await this.audit.append(tx, restartEvent(restart))
			return await this.overview.detailWithin(tx, restart.deliveryId)
		})
	}

	// queue_task_open_uniq
	private async requeueAssembly(tx: postgres.TransactionSql, acquisitionId: string): Promise<void> {
		if (await this.deliveries.reviveAssemblyTask(tx, acquisitionId)) {
			return
		}
		await this.assemblies.enqueue(tx, acquisitionId)
	}
}

// CAP-022-R15, CAP-025-R03, datovy-model.md 8
function restartEvent(restart: RecognitionRestart): NewAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.TEXT_RECOGNITION_RESTARTED,
		actorKind: AUDIT_ACTOR_KIND.USER,
		actorUserId: restart.administratorUserId,
		objectId: restart.deliveryId,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			acquisition_id: restart.acquisitionId,
			delivery_id: restart.deliveryId,
			reason: restart.reason,
			administrator_user_id: restart.administratorUserId,
		},
	}
}
