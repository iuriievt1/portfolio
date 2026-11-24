import { ACQUISITION_KIND } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { encounterRow, foundPatient, OTHER_USER, TODAY } from "../../encounter/__tests__/encounter-fixtures"
import { encounterViewOf } from "../../encounter/utils/encounter-view"
import { recordFile } from "../../image/__tests__/image-fixtures"
import { patientViewOf } from "../../registry/utils/patient-view"
import { acquisitionDetailOf, detailFileOf } from "../utils/acquisition-detail-view"
import { closedRecordOf, visibleRecordOf } from "../utils/closed-record"
import {
	CLOSED_AT,
	DETAIL_RECORD,
	photoRecord,
	scanRecord,
	storeScanOf,
	storeWoundOf,
} from "./acquisition-detail-fixtures"

const IMAGE = "c0000000-0000-4000-8000-000000000041"
const PAGE = "c0000000-0000-4000-8000-000000000042"
const NOTHING_VISIBLE = { findings: [], wounds: [], scans: [] }
const PATIENT_VIEW = patientViewOf(foundPatient())
const ENCOUNTER_VIEW = encounterViewOf(encounterRow(), 1, TODAY)

function closedPhoto() {
	const closed = closedRecordOf(photoRecord())
	if (closed === undefined) {
		throw new Error("the fixture record is not closed")
	}
	return closed
}

describe("closed record in the role scope CAP-020-R17", () => {
	it("CAP-020-S11 opens a closed record of another clinician the store shows", () => {
		const record = photoRecord({ operator_user_id: OTHER_USER })
		const closed = closedRecordOf(record)
		if (closed === undefined) {
			throw new Error("the fixture record is not closed")
		}

		expect(visibleRecordOf(closed, { ...NOTHING_VISIBLE, wounds: [storeWoundOf(record)] })).toEqual({
			...record,
			closed_at: CLOSED_AT,
		})
	})

	it("CAP-015-R17 does not open a draft, not even the own one", () => {
		expect(closedRecordOf(photoRecord({ state: ACQUISITION_STATE.DRAFT, closed_at: null }))).toBeUndefined()
	})

	it("CAP-020-S14 does not open a closed record the store does not show", () => {
		expect(visibleRecordOf(closedPhoto(), NOTHING_VISIBLE)).toBeUndefined()
	})

	it("ADR-054 bod 2 shows the clinical content the store holds", () => {
		const stored = { ...storeWoundOf(photoRecord()), healingPhaseCode: "granulating", findingId: undefined }

		expect(visibleRecordOf(closedPhoto(), { ...NOTHING_VISIBLE, wounds: [stored] })).toMatchObject({
			healing_phase_code: "granulating",
			finding_id: null,
		})
	})

	it("ADR-054 bod 2 shows the document title the store holds", () => {
		const scan = scanRecord()
		const closed = closedRecordOf(scan)
		if (closed === undefined) {
			throw new Error("the fixture record is not closed")
		}
		const stored = { ...storeScanOf(scan, 2), title: { code: undefined, text: "Propouštěcí zpráva" } }

		expect(visibleRecordOf(closed, { ...NOTHING_VISIBLE, scans: [stored] })).toMatchObject({
			title_code: null,
			title_text: "Propouštěcí zpráva",
		})
	})
})

describe("detail of a closed record clinical-workflow.yaml AcquisitionDetail", () => {
	it("CAP-020-S11 CAP-020-R19 carries the files, body site, assessment and the type the wound closed with", () => {
		const files = [recordFile({ id: IMAGE, acquisition_id: DETAIL_RECORD, edit_kind: "crop" })]

		const detail = acquisitionDetailOf(closedPhoto(), {
			patient: PATIENT_VIEW,
			encounter: ENCOUNTER_VIEW,
			files,
		})

		expect(detail).toEqual({
			acquisition_id: DETAIL_RECORD,
			kind: ACQUISITION_KIND.PHOTO,
			state: "received",
			patient: PATIENT_VIEW,
			encounter: ENCOUNTER_VIEW,
			closed_at: CLOSED_AT.toISOString(),
			finding_id: photoRecord().finding_id,
			wound_type_code: "leg-ulcer",
			wound_type_code_list_version: "4",
			is_image_data_available: true,
			files: [
				{ sequence: 1, image_id: IMAGE, page_id: null, thumbnail_url: `/images/${IMAGE}/thumbnail`, edit: "crop" },
			],
			body_site: {
				region_code: "25763004",
				laterality: "R",
				view: "anterior",
				x: 0.4,
				y: 0.8,
				body_diagram_version: "1",
			},
			assessment: {
				healing_phase_code: "sloughy",
				code_list_version: "4",
				description: "Spodina krytá fibrinovým povlakem.",
			},
		})
	})

	it("CAP-020-S12 carries the title and the pages of a scanned document", () => {
		const closed = closedRecordOf(scanRecord())
		if (closed === undefined) {
			throw new Error("the fixture document is not closed")
		}

		const detail = acquisitionDetailOf(closed, {
			patient: PATIENT_VIEW,
			encounter: ENCOUNTER_VIEW,
			files: [recordFile({ id: PAGE, acquisition_id: DETAIL_RECORD })],
		})

		expect(detail.document_title).toEqual({ text: "Lékařská zpráva" })
		expect(detail.wound_type_code).toBeNull()
		expect(detail.wound_type_code_list_version).toBeNull()
		expect(detail.body_site).toBeUndefined()
		expect(detail.files).toEqual([
			{ sequence: 1, image_id: null, page_id: PAGE, thumbnail_url: `/document-pages/${PAGE}/thumbnail`, edit: null },
		])
	})

	it("CAP-020-S13 CAP-020-S30 keeps the thumbnail past the retention of the original", () => {
		const detail = acquisitionDetailOf(closedPhoto(), {
			patient: PATIENT_VIEW,
			encounter: ENCOUNTER_VIEW,
			files: [recordFile({ id: IMAGE, is_available: false })],
		})

		expect(detail.is_image_data_available).toBe(false)
		expect(detail.files[0]?.thumbnail_url).toBe(`/images/${IMAGE}/thumbnail`)
	})

	it("CAP-020-S25 shows the type the wound closed with, not its type changed later", () => {
		const closed = closedRecordOf(
			photoRecord({ closed_wound_type_code: "traumatic-wound", closed_wound_type_code_list_version: 3 }),
		)
		if (closed === undefined) {
			throw new Error("the fixture record is not closed")
		}

		const detail = acquisitionDetailOf(closed, { patient: PATIENT_VIEW, encounter: ENCOUNTER_VIEW, files: [] })

		expect(detail.wound_type_code).toBe("traumatic-wound")
		expect(detail.wound_type_code_list_version).toBe("3")
	})

	it("CAP-020-R10 leaves a file without its thumbnail without a link", () => {
		expect(detailFileOf(ACQUISITION_KIND.PHOTO, recordFile({ has_thumbnail: false })).thumbnail_url).toBeNull()
	})
})
