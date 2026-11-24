import { JOB_KIND, JOB_STATE } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { WriteTaskRow } from "../types/monitoring.types"

// administration.yaml requeueClinicalRecordWrite, CAP-021-R27, CAP-021-R36
const REQUEUED_KINDS = [JOB_KIND.CLINICAL_RECORD_WRITE, JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD] as const

// CAP-021-R27, CAP-021-R31, CAP-021-R36, datovy-model.md 4
@Injectable()
export class ClinicalRecordWriteTaskRepository {
	async lock(tx: postgres.TransactionSql, taskId: string): Promise<WriteTaskRow | undefined> {
		const [row] = await tx<WriteTaskRow[]>`
			SELECT id, kind, state, object_kind, object_id FROM queue_task
			WHERE id = ${taskId} AND kind IN ${tx([...REQUEUED_KINDS])}
			FOR UPDATE
		`
		return row
	}

	// queue_task_open_uniq
	async openTaskOf(tx: postgres.TransactionSql, task: WriteTaskRow): Promise<string | undefined> {
		const [row] = await tx<{ id: string }[]>`
			SELECT id FROM queue_task
			WHERE kind = ${task.kind} AND object_kind = ${task.object_kind}
				AND object_id = ${task.object_id} AND state IN (${JOB_STATE.WAITING}, ${JOB_STATE.RUNNING})
			FOR UPDATE
		`
		return row?.id
	}

	// backend.md 2.4 requeueClinicalRecordWrite
	async revive(tx: postgres.TransactionSql, taskId: string): Promise<void> {
		await tx`
			UPDATE queue_task SET state = ${JOB_STATE.WAITING}, attempts = 0, unknown_outcomes = 0, run_after = now()
			WHERE id = ${taskId}
		`
	}

	// CAP-021-R31
	async hurry(tx: postgres.TransactionSql, taskId: string): Promise<void> {
		await tx`UPDATE queue_task SET run_after = now() WHERE id = ${taskId}`
	}

	// CAP-021-R31
	async closeMerged(tx: postgres.TransactionSql, taskId: string): Promise<void> {
		await tx`UPDATE queue_task SET state = ${JOB_STATE.DONE} WHERE id = ${taskId}`
	}
}
