import { ORPHANED_OBJECT_DELETION_REASON_MAX_LENGTH } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { orphanedObjectDeletionSchema } from "@/features/orphaned-objects/lib/orphaned-object-deletion.schema"
import { shortObjectIdOf } from "@/features/orphaned-objects/lib/orphaned-object-view"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"

const OBJECT_ID = "7c1e5a90-3b2d-4f61-8e0a-2c4b6d8f1a3e"

describe("deleting a set-aside orphaned object CAP-026-S08, administration.yaml OrphanedObjectDeletion", () => {
	it("CAP-026-S08 refuses a deletion without a reason", () => {
		const result = orphanedObjectDeletionSchema.safeParse({ reason: "   " })

		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.message).toBe(cs.orphanedObjects.deleteDialog.reasonMissing)
	})

	it("CAP-026-S08 refuses a reason longer than the contract allows", () => {
		const result = orphanedObjectDeletionSchema.safeParse({
			reason: "x".repeat(ORPHANED_OBJECT_DELETION_REASON_MAX_LENGTH + 1),
		})

		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.message).toBe(
			fillText(cs.errors.tooLong, { max: String(ORPHANED_OBJECT_DELETION_REASON_MAX_LENGTH) }),
		)
	})

	it("CAP-026-S08 sends the reason without the spaces around it", () => {
		expect(orphanedObjectDeletionSchema.parse({ reason: " Zbytek po přerušeném nahrávání " })).toEqual({
			reason: "Zbytek po přerušeném nahrávání",
		})
	})

	it("stavy-a-mikrocopy.md E67 names the object by the start of its identifier", () => {
		expect(shortObjectIdOf(OBJECT_ID)).toBe("7c1e5a90…")
		expect(fillText(cs.orphanedObjects.deleteDialog.body, { id: shortObjectIdOf(OBJECT_ID) })).toBe(
			"Objekt 7c1e5a90… se z úložiště smaže. Vrátit to nejde. Smazání se zapíše do auditní stopy s vaším jménem.",
		)
	})
})
