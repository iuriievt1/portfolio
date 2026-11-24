import { ORPHANED_OBJECT_DELETION_REASON_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"

// CAP-026-S08, administration.yaml OrphanedObjectDeletion
export const orphanedObjectDeletionSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(1, cs.orphanedObjects.deleteDialog.reasonMissing)
		.max(
			ORPHANED_OBJECT_DELETION_REASON_MAX_LENGTH,
			fillText(cs.errors.tooLong, { max: String(ORPHANED_OBJECT_DELETION_REASON_MAX_LENGTH) }),
		),
})

export type OrphanedObjectDeletionValues = z.infer<typeof orphanedObjectDeletionSchema>
