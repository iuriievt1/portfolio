import { type QueueClaimRule, type QueueLoopTiming, QueueTaskLoop } from "@ansora/core-server"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { AuditRepository } from "../../../libs/audit/audit.repository"
import type { DatabaseService } from "../../../libs/database/database.service"
import {
	UPLOAD_TASK_LEASE_MILLISECONDS,
	UPLOAD_TASK_POLL_MILLISECONDS,
} from "../constants/clinical-record-upload.constants"
import type { UploadAlertRepository } from "../repositories/upload-alert.repository"
import type { UploadTaskRepository } from "../repositories/upload-task.repository"
import type {
	AlertedFile,
	ClaimedUploadTask,
	UploadAlertKind,
	UploadJobKind,
	UploadObjectKindOf,
} from "../types/clinical-record-upload.types"
import { uploadAlertEventOf } from "../utils/upload-alert"

const UPLOAD_TASK_TIMING: QueueLoopTiming = {
	leaseMilliseconds: UPLOAD_TASK_LEASE_MILLISECONDS,
	pollMilliseconds: UPLOAD_TASK_POLL_MILLISECONDS,
}

// ADR-016 ř. 54, ADR-005 ř. 37, CAP-021-R36, CAP-021-R40
export abstract class UploadTaskLoop<Kind extends UploadJobKind, Context>
	extends QueueTaskLoop<UploadObjectKindOf<Kind>, Context>
	implements OnApplicationBootstrap, OnApplicationShutdown
{
	protected abstract readonly kind: Kind

	protected constructor(
		protected readonly database: DatabaseService,
		private readonly tasks: UploadTaskRepository,
		private readonly alerts: UploadAlertRepository,
		private readonly audit: AuditRepository,
	) {
		super(tasks.queue, UPLOAD_TASK_TIMING)
	}

	onApplicationBootstrap(): void {
		this.startPolling()
	}

	onApplicationShutdown(): void {
		this.stopPolling()
	}

	protected claimRule(): QueueClaimRule<UploadObjectKindOf<Kind>> {
		return this.tasks.claimRuleOf(this.kind)
	}

	// CAP-021-R36, CAP-021-R27
	protected async complete(
		task: ClaimedUploadTask<UploadObjectKindOf<Kind>>,
		work?: (tx: postgres.TransactionSql) => Promise<void>,
	): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await work?.(tx)
			await this.queue.complete(tx, task.id)
			await this.alerts.resolveForTask(tx, task.id)
		})
	}

	// CAP-021-R36, CAP-021-R40, CAP-028-R15
	protected async failWithAlert(
		task: ClaimedUploadTask<UploadObjectKindOf<Kind>>,
		file: AlertedFile<UploadObjectKindOf<Kind>>,
		kind: UploadAlertKind,
		message: string,
	): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.queue.fail(tx, task.id)
			const alertId = await this.alerts.raiseForTask(tx, kind, task.id, message)
			if (alertId === undefined) {
				return
			}
			await this.audit.appendSystemJob(
				tx,
				uploadAlertEventOf({ alertId, kind, message, taskId: task.id, file }),
				new Date(),
			)
		})
	}
}
