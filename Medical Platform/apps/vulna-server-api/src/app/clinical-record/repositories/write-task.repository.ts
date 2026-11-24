import { ADMINISTRATOR_ALERT_KIND, SYSTEM_JOB } from "@ansora/contracts"
import { type HeldQueueTask, JOB_KIND, QueueTaskStore } from "@ansora/core-server"
import type postgres from "@veevoy/postgres"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import { alertRaisedEventOf } from "../../monitoring/utils/alert-audit-event"
import { WRITE_FAILURE_MESSAGE } from "../constants/clinical-record.constants"
import type { ClaimedWriteTask, WriteTaskObjectKind } from "../types/clinical-record.types"

// datovy-model.md 4, ADR-016, CAP-021-R31
export abstract class WriteTaskRepository {
	readonly queue: QueueTaskStore

	protected constructor(
		protected readonly database: DatabaseService,
		private readonly alerts: AdministratorAlertRepository,
		private readonly audit: AuditRepository,
		readonly objectKind: WriteTaskObjectKind,
	) {
		this.queue = new QueueTaskStore(database)
	}

	// CAP-021-R31, queue_task_open_uniq
	async enqueue(tx: postgres.TransactionSql, objectId: string): Promise<void> {
		await this.queue.enqueue(tx, { kind: JOB_KIND.CLINICAL_RECORD_WRITE, objectKind: this.objectKind, objectId })
	}

	// CAP-021-R31, CAP-021-R27
	async complete(task: HeldQueueTask): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.queue.completeUnlessRequestedAgain(tx, task)
			await this.alerts.resolveForTask(tx, task.id)
		})
	}

	// CAP-021-R27, CAP-028-R15
	async fail(task: ClaimedWriteTask): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.queue.fail(tx, task.id)
			const message = WRITE_FAILURE_MESSAGE[this.objectKind]
			const alertId = await this.alerts.raiseForFailedWrite(tx, task.id, message)
			if (alertId === undefined) {
				return
			}
			const alert = {
				alertId,
				kind: ADMINISTRATOR_ALERT_KIND.CLINICAL_RECORD_WRITE_FAILED,
				message,
				subject: { task_id: task.id, object_kind: this.objectKind, object_id: task.objectId },
			}
			await this.audit.append(tx, alertRaisedEventOf(alert, SYSTEM_JOB.CLINICAL_RECORD_WRITE))
		})
	}
}
