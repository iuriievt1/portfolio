import type { QueueReportInput } from "../dto/queue-report.input.dto"
import type { QueueReport } from "../types/queue-state.types"

// CAP-019-R08
export function queueReportOf(input: QueueReportInput): QueueReport {
	return {
		waiting: input.waiting,
		failed: input.failed,
		oldestAcquiredAt: input.oldest_acquired_at === null ? undefined : new Date(input.oldest_acquired_at),
		detectedAt: new Date(input.detected_at),
	}
}
