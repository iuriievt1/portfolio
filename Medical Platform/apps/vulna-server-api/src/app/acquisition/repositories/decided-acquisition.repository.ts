import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Executor } from "../../../libs/database/database.service"
import type { AcquisitionRow, DecisionReason } from "../types/acquisition.types"

// datovy-model.md 4, CAP-019-R14
@Injectable()
export class DecidedAcquisitionRepository {
	// CAP-019-R14, CAP-021-R29
	async isDecided(sql: Executor, acquisitionId: string): Promise<boolean> {
		const [row] = await sql<{ present: boolean }[]>`
			SELECT EXISTS (SELECT 1 FROM decided_acquisition WHERE acquisition_id = ${acquisitionId}) AS present
		`
		return row?.present === true
	}

	async record(tx: postgres.TransactionSql, rows: readonly AcquisitionRow[], reason: DecisionReason): Promise<void> {
		if (rows.length === 0) {
			return
		}
		const decided = rows.map((row) => ({ acquisition_key: row.idempotency_key, acquisition_id: row.id, reason }))
		await tx`INSERT INTO decided_acquisition ${tx(decided, "acquisition_key", "acquisition_id", "reason")}`
	}
}
