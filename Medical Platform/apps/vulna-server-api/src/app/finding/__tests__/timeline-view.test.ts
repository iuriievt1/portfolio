import { describe, expect, it } from "vitest"
import { recordFile } from "../../image/__tests__/image-fixtures"
import { timelineItemOf, woundTypeChangeViewOf, woundTypeVersionText } from "../utils/timeline-view"
import { RECORD_ID, timelineRow, woundTypeChange } from "./finding-fixtures"

const FIRST_IMAGE = "c0000000-0000-4000-8000-000000000001"
const SECOND_IMAGE = "c0000000-0000-4000-8000-000000000002"
const CLOSED_TYPE = { code: "leg-ulcer", codeListVersion: 4 }

describe("timeline item clinical-workflow.yaml TimelineItem", () => {
	it("CAP-020-R09 CAP-020-R19 carries thumbnails, images, body site, assessment and the type it closed with", () => {
		const files = [
			recordFile({ id: FIRST_IMAGE, acquisition_id: RECORD_ID }),
			recordFile({ id: SECOND_IMAGE, acquisition_id: RECORD_ID, sequence: 2 }),
		]

		expect(timelineItemOf(timelineRow(), files)).toEqual({
			acquisition_id: RECORD_ID,
			time: "2026-09-12T07:10:00.000Z",
			kind: "photo",
			is_image_data_available: true,
			thumbnail_url: `/images/${FIRST_IMAGE}/thumbnail`,
			images: [
				{ image_id: FIRST_IMAGE, url: `/images/${FIRST_IMAGE}` },
				{ image_id: SECOND_IMAGE, url: `/images/${SECOND_IMAGE}` },
			],
			wound_type_code: "leg-ulcer",
			study_instance_uid: "2.25.42",
			accession_number: null,
			body_site: {
				region_code: "25763004",
				laterality: "R",
				view: "anterior",
				x: 0.4,
				y: 0.8,
				body_diagram_version: "1",
			},
			assessment: { healing_phase_code: "granulating", code_list_version: "4", description: "Okraje klidné" },
		})
	})

	it("CAP-020-R10 leaves the thumbnail empty when no image has one", () => {
		const item = timelineItemOf(timelineRow(), [recordFile({ has_thumbnail: false })])

		expect(item.thumbnail_url).toBeNull()
	})

	it("CAP-020-S30 keeps the thumbnail but drops the image link past the retention of the original", () => {
		const item = timelineItemOf(timelineRow(), [recordFile({ id: FIRST_IMAGE, is_available: false })])

		expect(item.is_image_data_available).toBe(false)
		expect(item.thumbnail_url).toBe(`/images/${FIRST_IMAGE}/thumbnail`)
		expect(item.images).toEqual([{ image_id: FIRST_IMAGE, url: null }])
	})

	it("CAP-020-S25 shows the type the record closed with, not the type changed later", () => {
		const item = timelineItemOf(timelineRow({ closed_wound_type_code: "traumatic-wound" }), [])

		expect(item.wound_type_code).toBe("traumatic-wound")
	})

	it("CAP-017-S11 leaves out the note the record does not carry", () => {
		const item = timelineItemOf(timelineRow({ description: null }), [])

		expect(item.assessment).toEqual({ healing_phase_code: "granulating", code_list_version: "4" })
	})
})

describe("wound type change on the timeline CAP-020-R19", () => {
	it("CAP-020-S25 shows when and from which type the wound type changed, without the user", () => {
		expect(woundTypeChangeViewOf(woundTypeChange())).toEqual({
			changed_at: "2026-08-20T10:00:00.000Z",
			previous_wound_type_code: "traumatic-wound",
			wound_type_code: "leg-ulcer",
		})
	})

	it("CAP-017-R09 writes the code list set version as text, or null without a type", () => {
		expect(woundTypeVersionText(CLOSED_TYPE)).toBe("4")
		expect(woundTypeVersionText({ code: null, codeListVersion: null })).toBeNull()
	})
})
