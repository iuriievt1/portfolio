import { Injectable } from "@nestjs/common"
import type { Executor } from "../../../libs/database/database.service"

// CAP-025-R22
@Injectable()
export class RecordedDeviceEventRepository {
	async recordNew(
		sql: Executor,
		idempotencyKeys: readonly string[],
		deviceId: string,
		now: Date,
	): Promise<ReadonlySet<string>> {
		const rows = await sql<{ idempotency_key: string }[]>`
			INSERT INTO recorded_device_event (idempotency_key, device_id, recorded_at)
			SELECT key, ${deviceId}, ${now} FROM unnest(${idempotencyKeys}::uuid[]) AS key
			ON CONFLICT (idempotency_key) DO NOTHING
			RETURNING idempotency_key
		`
		return new Set(rows.map((row) => row.idempotency_key))
	}
}
