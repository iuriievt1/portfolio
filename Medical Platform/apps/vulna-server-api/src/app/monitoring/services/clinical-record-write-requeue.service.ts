import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME, JOB_STATE } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { isUniqueViolation } from "../../../libs/database/unique-violation"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { REQUEUE_RACE_RETRIES } from "../constants/monitoring.constants"
import { AdministratorAlertRepository } from "../repositories/administrator-alert.repository"
import { ClinicalRecordWriteTaskRepository } from "../repositories/clinical-record-write-task.repository"
import type { WriteTaskRow } from "../types/monitoring.types"

// CAP-021-R27, CAP-021-S25, administration.yaml requeueClinicalRecordWrite
@Injectable()
export class ClinicalRecordWriteRequeueService {
	constructor(
		private readonly database: DatabaseService,
		private readonly tasks: ClinicalRecordWriteTaskRepository,
		private readonly alerts: AdministratorAlertRepository,
		private readonly audit: AuditRepository,
	) {}

	async requeue(taskId: string, administrator: AdministrationSession, retries = REQUEUE_RACE_RETRIES): Promise<void> {
		try {
			await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
				const task = await this.tasks.lock(tx, taskId)
				if (task === undefined) {
					throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
				}
				if (task.state !== JOB_STATE.FAILED) {
					throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.CLINICAL_RECORD_WRITE_NOT_FAILED)
				}
				await this.reschedule(tx, task)
				await this.audit.append(tx, requeueEvent(task, administrator))
			})
		} catch (error) {
			if (isUniqueViolation(error) && retries > 0) {
				await this.requeue(taskId, administrator, retries - 1)
				return
			}
			throw error
		}
	}

	// CAP-021-R31, queue_task_open_uniq
	private async reschedule(tx: postgres.TransactionSql, task: WriteTaskRow): Promise<void> {
		const openTaskId = await this.tasks.openTaskOf(tx, task)
		if (openTaskId === undefined) {
			await this.tasks.revive(tx, task.id)
			return
		}
		await this.tasks.hurry(tx, openTaskId)
		await this.tasks.closeMerged(tx, task.id)
		await this.alerts.handOver(tx, task.id, openTaskId)
	}
}

// CAP-025-R03, datovy-model.md 8
function requeueEvent(task: WriteTaskRow, administrator: AdministrationSession): NewAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.CLINICAL_RECORD_WRITE_REQUEUED,
		actorKind: AUDIT_ACTOR_KIND.USER,
		actorUserId: administrator.userId,
		objectId: task.id,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			administrator_user_id: administrator.userId,
			object_kind: task.object_kind,
			object_id: task.object_id,
		},
	}
}
