import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { UploadAlertKind } from "../types/clinical-record-upload.types"

// datovy-model.md 4 „Upozornění správce“, CAP-028-R15
@Injectable()
export class UploadAlertRepository {
	// CAP-021-R36, CAP-021-R40, administrator_alert_active_task_uniq
	async raiseForTask(
		tx: postgres.TransactionSql,
		kind: UploadAlertKind,
		taskId: string,
		message: string,
	): Promise<string | undefined> {
		const [raised] = await tx<{ id: string }[]>`
			INSERT INTO administrator_alert (id, kind, message, queue_task_id)
			VALUES (${randomUUID()}, ${kind}, ${message}, ${taskId})
			ON CONFLICT (queue_task_id) WHERE resolved_at IS NULL DO NOTHING
			RETURNING id
		`
		return raised?.id
	}

	// CAP-021-R36, CAP-021-R27
	async resolveForTask(tx: postgres.TransactionSql, taskId: string): Promise<void> {
		await tx`UPDATE administrator_alert SET resolved_at = now() WHERE queue_task_id = ${taskId} AND resolved_at IS NULL`
	}
}
