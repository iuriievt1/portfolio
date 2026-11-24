import { randomUUID } from "node:crypto"
import { REGISTRY_SYNC_OUTCOME, type RegistrySyncOutcome } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { SyncRun, SyncRunRow } from "../types/registry-sync.types"

function syncRunOf(row: SyncRunRow): SyncRun {
	return { id: row.id, startedAt: row.started_at }
}

// CAP-024-R04, CAP-024-R12, datovy-model.md 7
@Injectable()
export class SyncRunRepository {
	constructor(private readonly database: DatabaseService) {}

	async start(now: Date): Promise<SyncRun> {
		const id = randomUUID()
		await this.database.sql`INSERT INTO sync_run (id, started_at) VALUES (${id}, ${now})`
		return { id, startedAt: now }
	}

	async finish(
		tx: postgres.TransactionSql,
		runId: string,
		outcome: RegistrySyncOutcome,
		finishedAt: Date,
	): Promise<void> {
		await tx`UPDATE sync_run SET finished_at = ${finishedAt}, outcome = ${outcome} WHERE id = ${runId}`
	}

	// CAP-024-R08, NAB-347
	async fail(tx: postgres.TransactionSql, runId: string, finishedAt: Date): Promise<void> {
		await tx`
			UPDATE sync_run SET finished_at = ${finishedAt}, outcome = ${REGISTRY_SYNC_OUTCOME.INCOMPLETE}, failed = true
			WHERE id = ${runId}
		`
	}

	async closeAbandoned(tx: postgres.TransactionSql, now: Date): Promise<SyncRun[]> {
		const rows = await tx<SyncRunRow[]>`
			UPDATE sync_run SET finished_at = ${now}, outcome = ${REGISTRY_SYNC_OUTCOME.INCOMPLETE}, failed = true
			WHERE finished_at IS NULL
			RETURNING id, started_at
		`
		return rows.map(syncRunOf)
	}

	async lastStartedAt(): Promise<Date | undefined> {
		const [row] = await this.database.sql<{ started_at: Date }[]>`
			SELECT started_at FROM sync_run ORDER BY started_at DESC LIMIT 1
		`
		return row?.started_at
	}
}
