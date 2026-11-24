import type { SqlDatabase } from "./sql-database"

// CAP-009-S05, ADR-038, Q-076
export interface StorageLossRecords {
	record(lostAt: string): Promise<void>
	unacknowledgedFor(userId: string): Promise<string | undefined>
	acknowledge(lostAt: string, userId: string): Promise<void>
}

const UNACKNOWLEDGED_LOSS = `
SELECT lost_at FROM storage_loss
WHERE NOT EXISTS (
	SELECT 1 FROM storage_loss_acknowledgement
	WHERE storage_loss_acknowledgement.lost_at = storage_loss.lost_at AND storage_loss_acknowledgement.user_id = ?
)
ORDER BY lost_at
LIMIT 1`

export class SqlStorageLossRecords implements StorageLossRecords {
	constructor(private readonly db: SqlDatabase) {}

	async record(lostAt: string): Promise<void> {
		await this.db.runAsync("INSERT OR IGNORE INTO storage_loss (lost_at) VALUES (?)", [lostAt])
	}

	async unacknowledgedFor(userId: string): Promise<string | undefined> {
		const row = await this.db.getFirstAsync<{ lost_at: string }>(UNACKNOWLEDGED_LOSS, [userId])
		return row?.lost_at
	}

	async acknowledge(lostAt: string, userId: string): Promise<void> {
		await this.db.runAsync("INSERT OR IGNORE INTO storage_loss_acknowledgement (lost_at, user_id) VALUES (?, ?)", [
			lostAt,
			userId,
		])
	}
}
