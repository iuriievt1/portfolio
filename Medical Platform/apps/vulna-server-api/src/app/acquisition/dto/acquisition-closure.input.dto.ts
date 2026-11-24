import { DISCARD_SITUATION, type DiscardSituation } from "@ansora/contracts"
import { z } from "zod"

const FILE_COUNT_MAX = 10_000

// clinical-workflow.yaml AcquisitionClosure, CAP-021-R25, CAP-021-S10
export const acquisitionClosureSchema = z.strictObject({
	file_count: z.number().int().min(0).max(FILE_COUNT_MAX).nullable().optional(),
	completed_at: z.iso.datetime({ offset: true }),
	operator: z.strictObject({
		user_id: z.uuid(),
		session_id: z.uuid(),
	}),
})

export type AcquisitionClosureInput = z.infer<typeof acquisitionClosureSchema>

// clinical-workflow.yaml AcquisitionDiscardRequest, CAP-025-R20
export const acquisitionDiscardSchema = z.strictObject({
	situation: z.enum(Object.values(DISCARD_SITUATION) as [DiscardSituation, ...DiscardSituation[]]),
})

export type AcquisitionDiscardInput = z.infer<typeof acquisitionDiscardSchema>
