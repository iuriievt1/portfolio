import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import type { QueueReport } from "../types/queue-state.types"

@Injectable()
export class QueueReportRepository {
	constructor(private readonly database: DatabaseService) {}

	// CAP-019-R08, datovy-model.md 4
	async record(deviceId: string, report: QueueReport, receivedAt: Date): Promise<void> {
		await this.database.sql`
			UPDATE device SET
				queue_waiting_count = ${report.waiting},
				queue_failed_count = ${report.failed},
				queue_oldest_acquired_at = ${report.oldestAcquiredAt ?? null},
				queue_detected_at = ${report.detectedAt},
				queue_reported_at = ${receivedAt}
			WHERE id = ${deviceId} AND (queue_detected_at IS NULL OR queue_detected_at <= ${report.detectedAt})
		`
	}
}
