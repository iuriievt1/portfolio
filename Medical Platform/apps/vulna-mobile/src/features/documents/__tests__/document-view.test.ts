import { ENCOUNTER_STATUS } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { CodeListItem, LocalizedNames } from "../../../api/code-lists"
import type { PatientDocumentItem } from "../../../api/documents"
import type { Encounter } from "../../../api/encounters"
import cs from "../../../i18n/cs.json"
import { documentPagesOf, documentSectionsOf, documentTitleOf, documentVisitOf, hasImageData } from "../document-view"

const TITLES: CodeListItem[] = [
	{ code: "medical-report", text: "Lékařská zpráva", names: { cs: "Lékařská zpráva" }, is_selectable: true },
]

const czechName = (names: LocalizedNames) => names.cs ?? ""

const ENCOUNTER: Encounter = {
	encounter_id: "encounter",
	patient_id: "patient",
	date: "2026-09-04",
	source: "worklist",
	status: ENCOUNTER_STATUS.COMPLETED,
	started_at: "2026-09-04T12:20:00Z",
}

function document(id: string, closedAt: string): PatientDocumentItem {
	return {
		acquisition_id: id,
		closed_at: closedAt,
		encounter: ENCOUNTER,
		page_count: 1,
		document_title: { code: "medical-report", code_list_version: "1" },
		is_image_data_available: true,
	}
}

describe("documentTitleOf", () => {
	it("CAP-018-R15 prefers the own title and names a code by the code list", () => {
		expect(documentTitleOf({ text: "Žádanka na RTG" }, TITLES, czechName, cs)).toBe("Žádanka na RTG")
		expect(documentTitleOf({ code: "medical-report" }, TITLES, czechName, cs)).toBe("Lékařská zpráva")
	})

	it("CAP-015-R26 never shows a code the code list does not know", () => {
		expect(documentTitleOf({ code: "retired" }, TITLES, czechName, cs)).toBe("Dokument")
		expect(documentTitleOf(undefined, TITLES, czechName, cs)).toBe("Dokument")
	})
})

describe("documentVisitOf", () => {
	it("CAP-020-S15 names the visit the document belongs to with its day and time", () => {
		expect(documentVisitOf(ENCOUNTER, cs)).toBe("návštěva 4. 9. 2026 · 14:20")
	})

	it("CAP-014-S13 names a visit without a time only by its day", () => {
		expect(documentVisitOf({ ...ENCOUNTER, started_at: null, scheduled_time: null }, cs)).toBe("návštěva 4. 9. 2026")
	})
})

describe("documentPagesOf", () => {
	it("CAP-015-R28 declines the page count", () => {
		expect(documentPagesOf(1, cs)).toBe("1 strana")
		expect(documentPagesOf(3, cs)).toBe("3 strany")
		expect(documentPagesOf(5, cs)).toBe("5 stran")
	})
})

describe("documentSectionsOf", () => {
	it("CAP-020-R18 lists documents newest first by the month they were closed in", () => {
		const sections = documentSectionsOf(
			[
				document("august", "2026-08-27T08:30:00Z"),
				document("september-early", "2026-09-04T12:40:00Z"),
				document("september-late", "2026-09-12T07:18:00Z"),
			],
			"cs",
		)
		expect(sections.map((section) => section.key)).toEqual(["Září 2026", "Srpen 2026"])
		expect(sections.map((section) => section.items.map((item) => item.acquisition_id))).toEqual([
			["september-late", "september-early"],
			["august"],
		])
	})
})

describe("hasImageData", () => {
	it("CAP-020-S17 keeps the cover while the preview outlives the original pages", () => {
		const pastOriginal = { ...document("past", "2026-08-27T08:30:00Z"), is_image_data_available: false }
		expect(hasImageData({ ...pastOriginal, cover_page_id: "page" })).toBe(true)
	})

	it("CAP-020-R07 says the images are only in PACS once the preview is gone too", () => {
		const pastOriginal = { ...document("past", "2026-08-27T08:30:00Z"), is_image_data_available: false }
		expect(hasImageData({ ...pastOriginal, cover_page_id: null })).toBe(false)
	})
})
