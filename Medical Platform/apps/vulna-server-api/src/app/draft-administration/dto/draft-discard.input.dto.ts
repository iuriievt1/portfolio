import { DRAFT_DISCARD_REASONS, type DraftDiscardReason, PAGE_LIMIT_MAX } from "@ansora/contracts"
import { z } from "zod"

const selectionSchema = z.strictObject({
	acquisition_id: z.uuid(),
	seen_updated_at: z.iso.datetime({ offset: true }),
})

function hasDistinctAcquisitions(selections: readonly { acquisition_id: string }[]): boolean {
	return new Set(selections.map((selection) => selection.acquisition_id)).size === selections.length
}

// administration.yaml DraftDiscardRequest, CAP-015-R19, CAP-015-R20
export const draftDiscardSchema = z.strictObject({
	operator_user_id: z.uuid(),
	reason: z.enum(DRAFT_DISCARD_REASONS as [DraftDiscardReason, ...DraftDiscardReason[]]),
	acquisitions: z.array(selectionSchema).min(1).max(PAGE_LIMIT_MAX).refine(hasDistinctAcquisitions),
})

export type DraftDiscardInput = z.infer<typeof draftDiscardSchema>
