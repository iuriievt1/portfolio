import { CODE_LIST_ITEM_CODE_MAX_LENGTH } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { acquisitionDraftUpdateSchema } from "../dto/acquisition-draft-update.input.dto"

const FINDING = "f3000000-0000-4000-8000-000000000001"
const KEY = "f2000000-0000-4000-8000-000000000001"
const SITE = {
	region_code: "181553006",
	laterality: "R",
	view: "anterior",
	x: 0.375,
	y: 0.755,
	body_diagram_version: "1",
}

describe("update of a draft clinical-workflow.yaml AcquisitionDraftUpdate", () => {
	it("CAP-016-R17 accepts a new finding with its place or an existing finding alone", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ finding_key: KEY, body_site: SITE }).success).toBe(true)
		expect(acquisitionDraftUpdateSchema.safeParse({ finding_id: FINDING }).success).toBe(true)
	})

	it("refuses both an existing and a new finding", () => {
		expect(
			acquisitionDraftUpdateSchema.safeParse({ finding_id: FINDING, finding_key: KEY, body_site: SITE }).success,
		).toBe(false)
	})

	it("CAP-016-S01 refuses a new finding without a place", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ finding_key: KEY }).success).toBe(false)
	})

	it("refuses an update that carries nothing", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({}).success).toBe(false)
	})

	it("CAP-016-R04 refuses coordinates outside the view", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ finding_key: KEY, body_site: { ...SITE, x: 1.2 } }).success).toBe(
			false,
		)
	})

	it("CAP-016-R16 needs the laterality field even when it is empty", () => {
		const { laterality: _laterality, ...withoutLaterality } = SITE
		expect(acquisitionDraftUpdateSchema.safeParse({ finding_key: KEY, body_site: withoutLaterality }).success).toBe(
			false,
		)
		expect(
			acquisitionDraftUpdateSchema.safeParse({ finding_key: KEY, body_site: { ...SITE, laterality: null } }).success,
		).toBe(true)
	})

	it("CAP-017-R02 refuses a code list version without a wound type", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ code_list_version: "3" }).success).toBe(false)
		expect(
			acquisitionDraftUpdateSchema.safeParse({ wound_type_code: "leg-ulcer", code_list_version: "3" }).success,
		).toBe(true)
	})

	it("CAP-017-R02 refuses a wound type without its code list version", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ wound_type_code: "leg-ulcer" }).success).toBe(false)
	})

	it("refuses a place for a finding the same request clears", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ finding_id: null, body_site: SITE }).success).toBe(false)
		expect(acquisitionDraftUpdateSchema.safeParse({ finding_id: null }).success).toBe(true)
	})

	it("CAP-017-R16 refuses a code longer than a code list item code", () => {
		const code = "x".repeat(CODE_LIST_ITEM_CODE_MAX_LENGTH + 1)
		expect(acquisitionDraftUpdateSchema.safeParse({ wound_type_code: code, code_list_version: "3" }).success).toBe(
			false,
		)
	})

	it("refuses fields the contract does not know", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ finding_id: FINDING, note: "x" }).success).toBe(false)
	})
})

describe("document title clinical-workflow.yaml DocumentTitle CAP-018-R15", () => {
	it("accepts a code with its code list version or an own text", () => {
		expect(
			acquisitionDraftUpdateSchema.safeParse({ document_title: { code: "discharge-report", code_list_version: "3" } })
				.success,
		).toBe(true)
		expect(acquisitionDraftUpdateSchema.safeParse({ document_title: { text: "Nález z ortopedie" } }).success).toBe(true)
	})

	it("refuses both a code and a text, or neither", () => {
		expect(
			acquisitionDraftUpdateSchema.safeParse({
				document_title: { code: "discharge-report", text: "Nález", code_list_version: "3" },
			}).success,
		).toBe(false)
		expect(acquisitionDraftUpdateSchema.safeParse({ document_title: {} }).success).toBe(false)
	})

	it("refuses a code without its code list version", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ document_title: { code: "discharge-report" } }).success).toBe(false)
	})

	it("refuses an own title longer than 255 characters", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ document_title: { text: "x".repeat(256) } }).success).toBe(false)
	})

	it("integrace-dicom.md 5.6 refuses an own title with a control character Document Title cannot hold", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ document_title: { text: "Nález\u000bz ortopedie" } }).success).toBe(
			false,
		)
		expect(acquisitionDraftUpdateSchema.safeParse({ document_title: { text: "Nález\tz ortopedie" } }).success).toBe(
			true,
		)
	})
})

describe("assessment in the update of a draft clinical-workflow.yaml Assessment", () => {
	it("CAP-017-S16 accepts a note without a healing phase", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ assessment: { description: "Klidné okraje" } }).success).toBe(true)
	})

	it("CAP-017-R09 refuses a healing phase without its code list version", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ assessment: { healing_phase_code: "sloughy" } }).success).toBe(
			false,
		)
	})

	it("refuses an assessment that carries nothing", () => {
		expect(acquisitionDraftUpdateSchema.safeParse({ assessment: {} }).success).toBe(false)
	})
})
