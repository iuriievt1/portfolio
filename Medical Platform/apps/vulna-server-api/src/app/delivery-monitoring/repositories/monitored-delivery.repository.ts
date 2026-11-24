import { DELIVERY_INSTANCE_STATE, DELIVERY_STATE, DELIVERY_TARGET_STATE } from "@ansora/contracts"
import { JOB_KIND, JOB_OBJECT_KIND, JOB_STATE } from "@ansora/core-server"
import {
	ACQUISITION_STATE,
	assembledRecordStateOf,
	NO_VERIFICATION_REJECTIONS,
	type RecordDeliveryStates,
} from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type {
	InstanceClosure,
	LockedDelivery,
	LockedInstance,
	LockedTarget,
	LockedVerification,
} from "../types/delivery-monitoring.types"

// datovy-model.md 4 „Cíl doručení“, „Doručení“, CAP-028-R20
@Injectable()
export class MonitoredDeliveryRepository {
	async lockedTarget(tx: postgres.TransactionSql, code: string): Promise<LockedTarget | undefined> {
		const [target] = await tx<LockedTarget[]>`
			SELECT state, reason FROM delivery_target WHERE code = ${code} FOR UPDATE
		`
		return target
	}

	// CAP-023-R23, CAP-023-S10
	async resumeTarget(tx: postgres.TransactionSql, code: string, administratorUserId: string): Promise<void> {
		await tx`
			UPDATE delivery_target SET state = ${DELIVERY_TARGET_STATE.ACTIVE}, reason = NULL, changed_at = now(),
				resumed_by_user_id = ${administratorUserId}
			WHERE code = ${code} AND state = ${DELIVERY_TARGET_STATE.PAUSED}
		`
	}

	async lockedVerification(
		tx: postgres.TransactionSql,
		deliveryId: string,
		instanceId: string,
	): Promise<LockedVerification | undefined> {
		const [instance] = await tx<LockedVerification[]>`
			SELECT verification_on_hold_at, verification_rejections FROM delivery_instance
			WHERE id = ${instanceId} AND delivery_id = ${deliveryId}
			FOR UPDATE
		`
		return instance
	}

	// CAP-023-R26, CAP-023-S18, datovy-model.md 4 „Doručení“
	async resumeVerification(tx: postgres.TransactionSql, instanceId: string): Promise<void> {
		await tx`
			UPDATE delivery_instance SET verification_on_hold_at = NULL, verification_rejections = ${NO_VERIFICATION_REJECTIONS}
			WHERE id = ${instanceId}
		`
		await tx`
			UPDATE queue_task SET run_after = now()
			WHERE kind = ${JOB_KIND.DELIVERY} AND object_kind = ${JOB_OBJECT_KIND.DELIVERY_INSTANCE}
				AND object_id = ${instanceId} AND state = ${JOB_STATE.WAITING}
		`
	}

	// CAP-023-R28
	async lockedInstance(
		tx: postgres.TransactionSql,
		deliveryId: string,
		instanceId: string,
	): Promise<LockedInstance | undefined> {
		const [instance] = await tx<LockedInstance[]>`
			SELECT instance.state, delivery.acquisition_id
			FROM delivery_instance instance JOIN delivery ON delivery.id = instance.delivery_id
			WHERE instance.id = ${instanceId} AND instance.delivery_id = ${deliveryId}
			FOR UPDATE OF instance
		`
		return instance
	}

	// CAP-023-R28, CAP-023-S24, datovy-model.md 4 „Doručení“
	async close(tx: postgres.TransactionSql, closure: InstanceClosure): Promise<void> {
		await tx`
			UPDATE delivery_instance SET state = ${DELIVERY_INSTANCE_STATE.CLOSED_BY_ADMINISTRATOR},
				closed_from_state = ${closure.from}, closed_at = now(), closed_by_user_id = ${closure.administratorUserId},
				closure_reason = ${closure.reason}
			WHERE id = ${closure.instanceId}
		`
	}

	// PostgreSQL 13.2.1, 13.3.2
	async lockRecord(tx: postgres.TransactionSql, acquisitionId: string): Promise<void> {
		await tx`SELECT id FROM acquisition WHERE id = ${acquisitionId} FOR NO KEY UPDATE`
	}

	// datovy-model.md 4 „Pořízení“, CAP-023-R28
	async refreshAcquisitionState(tx: postgres.TransactionSql, acquisitionId: string): Promise<void> {
		const [states] = await tx<RecordDeliveryStates[]>`
			SELECT
				ARRAY(SELECT state FROM delivery WHERE acquisition_id = ${acquisitionId}) AS parents,
				ARRAY(
					SELECT instance.state FROM delivery_instance instance JOIN delivery ON delivery.id = instance.delivery_id
					WHERE delivery.acquisition_id = ${acquisitionId}
				) AS instances
		`
		if (states === undefined) {
			throw new Error("the record delivery states query returned no row")
		}
		await tx`
			UPDATE acquisition SET state = ${assembledRecordStateOf(states)}
			WHERE id = ${acquisitionId} AND state <> ${ACQUISITION_STATE.DRAFT}
		`
	}

	// CAP-022-R15
	async lockedDelivery(tx: postgres.TransactionSql, deliveryId: string): Promise<LockedDelivery | undefined> {
		const [delivery] = await tx<LockedDelivery[]>`
			SELECT state, reason, acquisition_id FROM delivery WHERE id = ${deliveryId} FOR UPDATE
		`
		return delivery
	}

	// CAP-022-R15, CAP-022-S06, datovy-model.md 4 „Doručení“
	async restartAssembly(tx: postgres.TransactionSql, deliveryId: string): Promise<void> {
		await tx`
			UPDATE delivery SET state = ${DELIVERY_STATE.WAITING_FOR_ASSEMBLY}, reason = NULL WHERE id = ${deliveryId}
		`
	}

	// CAP-022-R10, CAP-022-R15, dorucovaci-jadro.md 5.5
	async resetTextRecognition(tx: postgres.TransactionSql, acquisitionId: string): Promise<void> {
		await tx`UPDATE document SET text_recognition_failures = 0 WHERE acquisition_id = ${acquisitionId}`
	}

	// datovy-model.md 4 „Doručení“, queue_task_open_uniq
	async reviveAssemblyTask(tx: postgres.TransactionSql, acquisitionId: string): Promise<boolean> {
		const assemblyOfRecord = tx`
			kind = ${JOB_KIND.ASSEMBLY} AND object_kind = ${JOB_OBJECT_KIND.ACQUISITION} AND object_id = ${acquisitionId}
		`
		const revived = await tx`
			UPDATE queue_task SET state = ${JOB_STATE.WAITING}, attempts = 0, unknown_outcomes = 0, run_after = now()
			WHERE id = (
				SELECT id FROM queue_task WHERE ${assemblyOfRecord} AND state = ${JOB_STATE.FAILED}
				ORDER BY created_at DESC
				LIMIT 1
			)
				AND NOT EXISTS (
					SELECT 1 FROM queue_task
					WHERE ${assemblyOfRecord} AND state IN (${JOB_STATE.WAITING}, ${JOB_STATE.RUNNING})
				)
			RETURNING id
		`
		return revived.length > 0
	}
}
