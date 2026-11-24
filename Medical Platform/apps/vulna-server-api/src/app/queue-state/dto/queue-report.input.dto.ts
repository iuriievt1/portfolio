import { z } from "zod"
import { POSTGRES_INTEGER_MAX } from "../../../libs/database/postgres-integer"

// clinical-workflow.yaml QueueStateReport, CAP-019-R08, CAP-007-S08
export const queueReportSchema = z
	.strictObject({
		waiting: z.int().min(0).max(POSTGRES_INTEGER_MAX),
		failed: z.int().min(0).max(POSTGRES_INTEGER_MAX),
		oldest_acquired_at: z.iso.datetime({ offset: true }).nullable(),
		detected_at: z.iso.datetime({ offset: true }),
	})
	.refine((report) => (report.waiting + report.failed === 0) === (report.oldest_acquired_at === null), {
		message: "is null exactly when the queue is empty",
		path: ["oldest_acquired_at"],
	})

export type QueueReportInput = z.infer<typeof queueReportSchema>
