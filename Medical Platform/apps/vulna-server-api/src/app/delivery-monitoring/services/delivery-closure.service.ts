import { ADMINISTRATION_ERROR_CODE, isClosableDeliveryInstanceState } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import { ALERT_KIND_OF_CLOSABLE_STATE } from "../constants/delivery-monitoring.constants"
import type { DeliveryClosureInput } from "../dto/delivery-closure.input.dto"
import { MonitoredDeliveryRepository } from "../repositories/monitored-delivery.repository"
import type { DeliveryView, InstanceClosure } from "../types/delivery-monitoring.types"
import { DeliveryOverviewService } from "./delivery-overview.service"

// CAP-023-R28, CAP-023-S24, CAP-023-S26, administration.yaml closeDeliveryInstance
@Injectable()
export class DeliveryClosureService {
	constructor(
		private readonly database: DatabaseService,
		private readonly deliveries: MonitoredDeliveryRepository,
		private readonly overview: DeliveryOverviewService,
		private readonly alerts: AdministratorAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	async close(
		deliveryId: string,
		instanceId: string,
		input: DeliveryClosureInput,
		administrator: AdministrationSession,
	): Promise<DeliveryView> {
		return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const instance = await this.deliveries.lockedInstance(tx, deliveryId, instanceId)
			if (instance === undefined) {
				throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
			}
			if (!isClosableDeliveryInstanceState(instance.state)) {
				throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.DELIVERY_NOT_CLOSABLE)
			}
			const closure: InstanceClosure = {
				deliveryId,
				instanceId,
				acquisitionId: instance.acquisition_id,
				from: instance.state,
				reason: input.reason,
				note: input.note,
				administratorUserId: administrator.userId,
			}
			await this.deliveries.close(tx, closure)
			await this.deliveries.lockRecord(tx, closure.acquisitionId)
			await this.deliveries.refreshAcquisitionState(tx, closure.acquisitionId)
			await this.alerts.resolveForInstance(tx, ALERT_KIND_OF_CLOSABLE_STATE[closure.from], instanceId)
			await this.audit.append(tx, closureEvent(closure))
			return await this.overview.detailWithin(tx, deliveryId)
		})
	}
}

// CAP-025-R03, datovy-model.md 8
function closureEvent(closure: InstanceClosure): NewAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.DELIVERY_CLOSED,
		actorKind: AUDIT_ACTOR_KIND.USER,
		actorUserId: closure.administratorUserId,
		objectId: closure.instanceId,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			acquisition_id: closure.acquisitionId,
			delivery_id: closure.deliveryId,
			delivery_instance_id: closure.instanceId,
			closed_from_state: closure.from,
			reason: closure.reason,
			note: closure.note ?? null,
			administrator_user_id: closure.administratorUserId,
		},
	}
}
