import { randomUUID } from "node:crypto"
import { ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"

// datovy-model.md 4, CAP-026-R16, CAP-028-R15
@Injectable()
export class StaleDraftsAlertRepository {
	// administrator_alert_active_stale_drafts_uniq
	async raise(tx: postgres.TransactionSql, message: string): Promise<string | undefined> {
		const [raised] = await tx<{ id: string }[]>`
			INSERT INTO administrator_alert (id, kind, message)
			VALUES (${randomUUID()}, ${ADMINISTRATOR_ALERT_KIND.STALE_ACQUISITION_DRAFTS}, ${message})
			ON CONFLICT (kind) WHERE resolved_at IS NULL AND kind = 'stale_acquisition_drafts' DO NOTHING
			RETURNING id
		`
		return raised?.id
	}

	async refresh(tx: postgres.TransactionSql, message: string): Promise<void> {
		await tx`
			UPDATE administrator_alert SET message = ${message}
			WHERE kind = ${ADMINISTRATOR_ALERT_KIND.STALE_ACQUISITION_DRAFTS} AND resolved_at IS NULL
		`
	}

	async resolve(tx: postgres.TransactionSql): Promise<void> {
		await tx`
			UPDATE administrator_alert SET resolved_at = now()
			WHERE kind = ${ADMINISTRATOR_ALERT_KIND.STALE_ACQUISITION_DRAFTS} AND resolved_at IS NULL
		`
	}
}
