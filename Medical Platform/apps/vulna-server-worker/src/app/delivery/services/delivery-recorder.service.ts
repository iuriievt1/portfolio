import { ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, type HeldQueueLease } from "@ansora/core-server"
import { isDeliveryInstanceSettled } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import { DatabaseService } from "../../../libs/database/database.service"
import { NO_DELAY_MILLISECONDS, TARGET_CHANGE, TASK_ACTION } from "../constants/delivery.constants"
import { DeliveryAlertRepository } from "../repositories/delivery-alert.repository"
import { DeliveryInstanceRepository } from "../repositories/delivery-instance.repository"
import { DeliveryTargetRepository } from "../repositories/delivery-target.repository"
import type {
	ClaimedDeliveryTask,
	DeliveryInstance,
	DeliveryStep,
	InstanceAlert,
	TargetChange,
	TaskAction,
} from "../types/delivery.types"
import { targetPausedMessageOf } from "../utils/delivery-alert"
import { deliveryAlertEventOf, instanceDetailsOf, targetEventOf } from "../utils/delivery-audit"

// dorucovaci-jadro.md 5, 5.3, 5.4, CAP-023-R07, CAP-023-R25
@Injectable()
export class DeliveryRecorderService {
	private readonly logger = new Logger(DeliveryRecorderService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly instances: DeliveryInstanceRepository,
		private readonly targets: DeliveryTargetRepository,
		private readonly alerts: DeliveryAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	// CAP-023-R25, datovy-model.md 4 „Cíl doručení“
	async markSending(task: ClaimedDeliveryTask, instance: DeliveryInstance, lease: HeldQueueLease): Promise<boolean> {
		return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			if (!(await this.proceeds(tx, task, instance, lease))) {
				return false
			}
			if (!(await this.instances.markSending(tx, instance.id, instance.state))) {
				throw new Error(`delivery instance ${instance.id} left the state ${instance.state} under the lease`)
			}
			return true
		})
	}

	// datovy-model.md 4 „Cíl doručení“, CAP-023-R26
	async mayVerify(task: ClaimedDeliveryTask, instance: DeliveryInstance, lease: HeldQueueLease): Promise<boolean> {
		return await this.database.sql.begin(
			async (tx: postgres.TransactionSql) => await this.proceeds(tx, task, instance, lease),
		)
	}

	// datovy-model.md 4 „Úloha fronty“
	async record(
		task: ClaimedDeliveryTask,
		instance: DeliveryInstance,
		step: DeliveryStep,
		lease: HeldQueueLease,
	): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			if (!(await this.isHeld(tx, task, lease))) {
				return
			}
			if (!(await this.instances.transition(tx, instance.id, step.transition))) {
				throw new Error(`delivery instance ${instance.id} left the state ${step.transition.from} under the lease`)
			}
			await this.instances.lockRecord(tx, instance.acquisitionId)
			await this.instances.refreshAcquisitionState(tx, instance.acquisitionId)
			if (isDeliveryInstanceSettled(step.transition.to)) {
				await this.instances.requestClinicalRecordWrites(tx, instance.acquisitionId)
			}
			const targetEvents = await this.changeTarget(tx, instance.targetCode, step.target)
			const alertEvents = await this.raiseInstanceAlert(tx, instance, step.alert)
			await this.appendAll(tx, [...step.events, ...targetEvents, ...alertEvents])
			await this.settleTask(tx, task, step.task)
		})
	}

	// datovy-model.md 4 „Úloha fronty“
	async complete(task: ClaimedDeliveryTask, lease: HeldQueueLease): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			if (await this.isHeld(tx, task, lease)) {
				await this.instances.queue.complete(tx, task.id)
			}
		})
	}

	// datovy-model.md 4 „Úloha fronty“
	async postpone(task: ClaimedDeliveryTask, lease: HeldQueueLease, delayMilliseconds: number): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			if (await this.isHeld(tx, task, lease)) {
				await this.instances.queue.retryLaterWithin(tx, task.id, delayMilliseconds)
			}
		})
	}

	private async proceeds(
		tx: postgres.TransactionSql,
		task: ClaimedDeliveryTask,
		instance: DeliveryInstance,
		lease: HeldQueueLease,
	): Promise<boolean> {
		if (!(await this.isHeld(tx, task, lease))) {
			return false
		}
		if (await this.targets.isActive(tx, instance.targetCode)) {
			return true
		}
		await this.instances.queue.retryLaterWithin(tx, task.id, NO_DELAY_MILLISECONDS)
		return false
	}

	private async isHeld(
		tx: postgres.TransactionSql,
		task: ClaimedDeliveryTask,
		lease: HeldQueueLease,
	): Promise<boolean> {
		const isHeld = await this.instances.queue.isHeld(tx, task.id, lease.lockedBy)
		if (!isHeld) {
			this.logger.warn(`Task ${task.id} is no longer held by ${lease.lockedBy}; its result is not written`)
		}
		return isHeld
	}

	private async appendAll(tx: postgres.TransactionSql, events: readonly SystemJobAuditEvent[]): Promise<void> {
		const now = new Date()
		for (const event of events) {
			await this.audit.appendSystemJob(tx, event, now)
		}
	}

	// dorucovaci-jadro.md 5.3, CAP-023-R11, CAP-023-R23, CAP-023-R24
	private async changeTarget(
		tx: postgres.TransactionSql,
		targetCode: string,
		change: TargetChange | undefined,
	): Promise<SystemJobAuditEvent[]> {
		if (change === undefined) {
			return []
		}
		switch (change.kind) {
			case TARGET_CHANGE.UNAVAILABLE:
				return await this.markUnavailable(tx, targetCode, change)
			case TARGET_CHANGE.PAUSED:
				return await this.pause(tx, targetCode, change)
			default:
				return change.kind satisfies never
		}
	}

	// CAP-023-R24
	private async markUnavailable(
		tx: postgres.TransactionSql,
		targetCode: string,
		change: TargetChange,
	): Promise<SystemJobAuditEvent[]> {
		const reason = change.exchange.classification.ruleId
		if (!(await this.targets.markUnavailable(tx, targetCode, reason))) {
			return []
		}
		return [targetEventOf(AUDIT_EVENT_TYPE.TARGET_UNAVAILABLE, targetCode, reason)]
	}

	// CAP-023-R11, CAP-023-R23
	private async pause(
		tx: postgres.TransactionSql,
		targetCode: string,
		change: TargetChange,
	): Promise<SystemJobAuditEvent[]> {
		const reason = change.exchange.classification.ruleId
		if (!(await this.targets.pause(tx, targetCode, reason))) {
			return []
		}
		await this.alerts.resolveForTarget(tx, ADMINISTRATOR_ALERT_KIND.TARGET_UNAVAILABILITY, targetCode)
		const message = targetPausedMessageOf(change.exchange)
		const alertId = await this.alerts.raiseForTarget(tx, ADMINISTRATOR_ALERT_KIND.TARGET_PAUSED, targetCode, message)
		const paused = targetEventOf(AUDIT_EVENT_TYPE.TARGET_PAUSED, targetCode, reason)
		if (alertId === undefined) {
			return [paused]
		}
		const subject = { target_code: targetCode, reason }
		return [paused, deliveryAlertEventOf(alertId, ADMINISTRATOR_ALERT_KIND.TARGET_PAUSED, message, subject)]
	}

	// CAP-023-R09, CAP-023-R12, CAP-023-R17, CAP-023-R26
	private async raiseInstanceAlert(
		tx: postgres.TransactionSql,
		instance: DeliveryInstance,
		alert: InstanceAlert | undefined,
	): Promise<SystemJobAuditEvent[]> {
		if (alert === undefined) {
			return []
		}
		const alertId = await this.alerts.raiseForInstance(
			tx,
			alert.kind,
			{ deliveryId: instance.deliveryId, instanceId: instance.id },
			alert.message,
		)
		if (alertId === undefined) {
			return []
		}
		return [deliveryAlertEventOf(alertId, alert.kind, alert.message, instanceDetailsOf(instance))]
	}

	private async settleTask(tx: postgres.TransactionSql, task: ClaimedDeliveryTask, action: TaskAction): Promise<void> {
		switch (action.kind) {
			case TASK_ACTION.COMPLETE:
				await this.instances.queue.complete(tx, task.id)
				return
			case TASK_ACTION.FAIL:
				await this.instances.queue.fail(tx, task.id)
				return
			case TASK_ACTION.WAIT:
				await this.instances.queue.retryLaterWithin(tx, task.id, action.delayMilliseconds)
				return
			default:
				return action satisfies never
		}
	}
}
