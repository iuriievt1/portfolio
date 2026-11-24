import { DRAFT_DISCARD_REASONS, type DraftDiscardReason } from "@ansora/contracts"
import { z } from "zod"
import cs from "@/i18n/cs.json"

// CAP-015-R19
export const draftDiscardSchema = z.object({
	reason: z.enum(DRAFT_DISCARD_REASONS as [DraftDiscardReason, ...DraftDiscardReason[]], {
		error: cs.drafts.consent.reasonMissing,
	}),
})

export type DraftDiscardValues = z.infer<typeof draftDiscardSchema>
