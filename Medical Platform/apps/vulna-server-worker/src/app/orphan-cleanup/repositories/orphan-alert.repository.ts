import { randomUUID } from "node:crypto"
import { ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"

// datovy-model.md 4 „Upozornění správce“, CAP-026-R14, CAP-028-R15
@Injectable()
export class OrphanAlertRepository {
	async raise(tx: postgres.TransactionSql, message: string, setAsideCount: number): Promise<string> {
		const alertId = randomUUID()
		await tx`
			INSERT INTO administrator_alert (id, kind, message, set_aside_object_count)
			VALUES (${alertId}, ${ADMINISTRATOR_ALERT_KIND.ORPHANED_OBJECTS_SET_ASIDE}, ${message}, ${setAsideCount})
		`
		return alertId
	}
}
