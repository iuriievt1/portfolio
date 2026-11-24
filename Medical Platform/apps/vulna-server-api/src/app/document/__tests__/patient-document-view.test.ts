import { describe, expect, it } from "vitest"
import { documentTitleViewOf } from "../../acquisition/utils/document-title-view"
import { encounterRow, TODAY } from "../../encounter/__tests__/encounter-fixtures"
import { encounterViewOf } from "../../encounter/utils/encounter-view"
import { recordFile } from "../../image/__tests__/image-fixtures"
import type { PatientDocumentRow } from "../types/document.types"
import { patientDocumentItemOf } from "../utils/patient-document-view"

const DOCUMENT_RECORD = "a0000000-0000-4000-8000-000000000030"
const ENCOUNTER_VIEW = encounterViewOf(encounterRow(), 2, TODAY)

function documentRow(overrides: Partial<PatientDocumentRow> = {}): PatientDocumentRow {
	return {
		id: DOCUMENT_RECORD,
		encounter_id: ENCOUNTER_VIEW.encounter_id,
		closed_at: new Date("2026-09-04T12:40:00Z"),
		file_count: 3,
		cursor_moment: "2026-09-04T12:40:00.000000Z",
		title_code: "medical-report",
		title_text: null,
		title_code_list_version: 5,
		...overrides,
	}
}

describe("document title CAP-018-R15", () => {
	it("CAP-017-R08 carries the code of the title with its code list set version", () => {
		expect(documentTitleViewOf(documentRow())).toEqual({ code: "medical-report", code_list_version: "5" })
	})

	it("CAP-018-R15 carries a title written by the clinician as text", () => {
		const row = documentRow({ title_code: null, title_code_list_version: null, title_text: "Kontrola po operaci" })

		expect(documentTitleViewOf(row)).toEqual({ text: "Kontrola po operaci" })
	})

	it("has no title when neither is set", () => {
		expect(documentTitleViewOf({ title_code: null, title_text: null, title_code_list_version: null })).toBeUndefined()
	})
})

describe("document of a patient CAP-020-R18", () => {
	it("CAP-020-S15 carries the closing time, the visit, the page count and the title", () => {
		const pages = [
			recordFile({ acquisition_id: DOCUMENT_RECORD }),
			recordFile({ acquisition_id: DOCUMENT_RECORD, sequence: 2 }),
			recordFile({ acquisition_id: DOCUMENT_RECORD, sequence: 3 }),
		]

		expect(patientDocumentItemOf(documentRow(), pages, ENCOUNTER_VIEW)).toEqual({
			acquisition_id: DOCUMENT_RECORD,
			closed_at: "2026-09-04T12:40:00.000Z",
			encounter: ENCOUNTER_VIEW,
			page_count: 3,
			document_title: { code: "medical-report", code_list_version: "5" },
			is_image_data_available: true,
			cover_page_id: pages[0]?.id,
		})
	})

	it("CAP-020-R10 takes the first page with a thumbnail as the cover and none without one", () => {
		const first = recordFile({ id: "c0000000-0000-4000-8000-000000000001", sequence: 1, has_thumbnail: false })
		const second = recordFile({ id: "c0000000-0000-4000-8000-000000000002", sequence: 2 })

		expect(patientDocumentItemOf(documentRow(), [second, first], ENCOUNTER_VIEW).cover_page_id).toBe(second.id)
		expect(patientDocumentItemOf(documentRow(), [first], ENCOUNTER_VIEW).cover_page_id).toBeNull()
	})

	it("CAP-020-S17 keeps a document past the retention of its pages with the metadata", () => {
		const item = patientDocumentItemOf(documentRow(), [recordFile({ is_available: false })], ENCOUNTER_VIEW)

		expect(item.is_image_data_available).toBe(false)
		expect(item.page_count).toBe(3)
	})

	it("CAP-021-R25 counts the pages announced at closing, not the page files it still lists", () => {
		const item = patientDocumentItemOf(documentRow({ file_count: 2 }), [recordFile()], ENCOUNTER_VIEW)

		expect(item.page_count).toBe(2)
	})

	it("refuses a closed document without a title, which closing never allows", () => {
		const row = documentRow({ title_code: null, title_code_list_version: null })

		expect(() => patientDocumentItemOf(row, [], ENCOUNTER_VIEW)).toThrow(DOCUMENT_RECORD)
	})
})
