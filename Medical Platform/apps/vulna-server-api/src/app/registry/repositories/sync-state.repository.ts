import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import type { SyncRunStateRow } from "../types/registry.types"

// NAB-347, CAP-024-R04
@Injectable()
export class SyncStateRepository {
	constructor(private readonly database: DatabaseService) {}

	async latestRun(): Promise<SyncRunStateRow | undefined> {
		const [row] = await this.database.sql<SyncRunStateRow[]>`
			SELECT started_at, finished_at, outcome, failed FROM sync_run ORDER BY started_at DESC LIMIT 1
		`
		return row
	}

	async cachedPatientCount(): Promise<number> {
		const [row] = await this.database.sql<{ count: string }[]>`SELECT count(*) AS count FROM patient_cache`
		return Number(row?.count ?? 0)
	}
}
