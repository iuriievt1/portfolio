import { type AdministrationContract, ORPHANED_OBJECT_DELETION_REASON_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"

type OrphanedObjectDeletion = AdministrationContract.components["schemas"]["OrphanedObjectDeletion"]

// administration.yaml OrphanedObjectDeletion, CAP-026-S08
export const orphanedObjectDeletionSchema = z.strictObject({
	reason: z.string().trim().min(1).max(ORPHANED_OBJECT_DELETION_REASON_MAX_LENGTH),
}) satisfies z.ZodType<OrphanedObjectDeletion>

export type OrphanedObjectDeletionInput = z.infer<typeof orphanedObjectDeletionSchema>
