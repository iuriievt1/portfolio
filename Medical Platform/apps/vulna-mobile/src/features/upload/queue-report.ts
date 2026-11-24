import { type BufferedFile, isFailed } from "@ansora/core-mobile"
import type { QueueStateReport } from "../../api/queue"
import { isAwaitingServer } from "./waiting-files"

// CAP-019-R08, CAP-019-R24, CAP-007-S08, Q-076
export function queueReportOf(files: readonly BufferedFile[], detectedAt: Date): QueueStateReport {
	const waiting = files.filter(isAwaitingServer)
	const failed = files.filter(isFailed)
	const unsentCaptures = [...waiting, ...failed].map((file) => Date.parse(file.capturedAt))
	return {
		waiting: waiting.length,
		failed: failed.length,
		oldest_acquired_at: unsentCaptures.length === 0 ? null : new Date(Math.min(...unsentCaptures)).toISOString(),
		detected_at: detectedAt.toISOString(),
	}
}
