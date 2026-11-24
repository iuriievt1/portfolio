import { randomUUID } from "node:crypto"
import { ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"

// datovy-model.md 4 „Upozornění správce“, CAP-022-R11, CAP-028-R15
@Injectable()
export class AssemblyAlertRepository {
	// administrator_alert_active_task_uniq, administrator_alert_delivery_check
	async raise(
		tx: postgres.TransactionSql,
		taskId: string,
		deliveryId: string,
		message: string,
	): Promise<string | undefined> {
		const [raised] = await tx<{ id: string }[]>`
			INSERT INTO administrator_alert (id, kind, message, queue_task_id, delivery_id)
			VALUES (${randomUUID()}, ${ADMINISTRATOR_ALERT_KIND.ASSEMBLY_FAILED}, ${message}, ${taskId}, ${deliveryId})
			ON CONFLICT (queue_task_id) WHERE resolved_at IS NULL DO NOTHING
			RETURNING id
		`
		return raised?.id
	}

	// CAP-021-R41, administrator_alert_assembly_paused_uniq
	async raisePause(tx: postgres.TransactionSql, message: string): Promise<string | undefined> {
		const [active] = await tx<{ id: string; message: string }[]>`
			SELECT id, message FROM administrator_alert
			WHERE kind = ${ADMINISTRATOR_ALERT_KIND.ASSEMBLY_PAUSED} AND resolved_at IS NULL
			FOR UPDATE
		`
		if (active?.message === message) {
			return undefined
		}
		if (active !== undefined) {
			await tx`UPDATE administrator_alert SET resolved_at = now() WHERE id = ${active.id}`
		}
		const [raised] = await tx<{ id: string }[]>`
			INSERT INTO administrator_alert (id, kind, message)
			VALUES (${randomUUID()}, ${ADMINISTRATOR_ALERT_KIND.ASSEMBLY_PAUSED}, ${message})
			ON CONFLICT DO NOTHING
			RETURNING id
		`
		return raised?.id
	}

	// CAP-021-R41, datovy-model.md 4 „Upozornění správce“
	async resolvePause(tx: postgres.TransactionSql): Promise<void> {
		await tx`
			UPDATE administrator_alert SET resolved_at = now()
			WHERE kind = ${ADMINISTRATOR_ALERT_KIND.ASSEMBLY_PAUSED} AND resolved_at IS NULL
		`
	}
}
