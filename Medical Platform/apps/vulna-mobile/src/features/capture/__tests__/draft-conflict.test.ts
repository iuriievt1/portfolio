import { describe, expect, it } from "vitest"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import { isChangedOnlyInFiles } from "../draft-conflict"

const KNOWN = {
	acquisition_id: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10",
	kind: "scan",
	version: 3,
	updated_at: "2026-10-08T09:00:00Z",
	files: [],
	document_title: undefined,
} as unknown as AcquisitionDraft

const UPLOADED = {
	...KNOWN,
	version: 5,
	updated_at: "2026-10-08T09:00:04Z",
	files: [{ file_key: "first", status: "received" }],
} as unknown as AcquisitionDraft

describe("draft conflict", () => {
	it("E115 treats our own uploaded pages as no change to the record", () => {
		expect(isChangedOnlyInFiles(KNOWN, UPLOADED)).toBe(true)
	})

	it("CAP-021-R32 sees a title set on another device", () => {
		const elsewhere = { ...UPLOADED, document_title: { text: "Propouštěcí zpráva" } } as unknown as AcquisitionDraft

		expect(isChangedOnlyInFiles(KNOWN, elsewhere)).toBe(false)
	})
})
