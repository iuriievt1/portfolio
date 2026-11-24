import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { REGISTRY_SYNC_LOCK_NAME } from "../constants/registry-sync.constants"

// CAP-024-R09
@Injectable()
export class SyncLockRepository {
	constructor(private readonly database: DatabaseService) {}

	async whileHeld<T>(work: () => Promise<T>): Promise<T | undefined> {
		const connection = await this.database.sql.reserve()
		try {
			const [row] = await connection<{ locked: boolean }[]>`
				SELECT pg_try_advisory_lock(hashtext(${REGISTRY_SYNC_LOCK_NAME})::bigint) AS locked
			`
			if (row?.locked !== true) {
				return undefined
			}
			try {
				return await work()
			} finally {
				await connection`SELECT pg_advisory_unlock(hashtext(${REGISTRY_SYNC_LOCK_NAME})::bigint)`
			}
		} finally {
			connection.release()
		}
	}
}
