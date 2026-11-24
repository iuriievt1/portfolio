import { ACQUISITION_KIND } from "@ansora/contracts"
import { ACQUISITION_STATE, type ClinicalSteps } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { NO_PROGRESS } from "../constants/encounter.constants"
import { encounterAcquisitionItemOf, recordMissingStepOf } from "../utils/encounter-view"
import { acquisitionRow, NOW } from "./encounter-fixtures"

const FINDING = "f0000000-0000-4000-8000-000000000001"
const ALL_STEPS: ClinicalSteps = { woundType: true, healingPhase: true }
const LOCATION_ONLY: ClinicalSteps = { woundType: false, healingPhase: false }

describe("content row of a visit CAP-014-R22", () => {
	it("CAP-019-R28 shows a closed record as received with the files the server holds", () => {
		const closed = acquisitionRow({ state: ACQUISITION_STATE.DELIVERED, closed_at: NOW, file_count: 4 })

		const item = encounterAcquisitionItemOf(closed, { ...NO_PROGRESS, received_count: 3 }, ALL_STEPS)

		expect(item).toEqual({
			acquisition_id: closed.id,
			kind: ACQUISITION_KIND.PHOTO,
			state: "received",
			file_count: 3,
			updated_at: NOW.toISOString(),
			missing_step: null,
			missing_file_count: 0,
			rejected_file_count: 0,
			files_on_other_device: false,
		})
	})

	it("CAP-015-R35 CAP-015-R36 counts missing and rejected files of a draft and files on another device", () => {
		const draft = acquisitionRow({ finding_id: FINDING })

		const item = encounterAcquisitionItemOf(
			draft,
			{
				...NO_PROGRESS,
				received_count: 1,
				announced_count: 2,
				rejected_count: 1,
				files_on_other_device: true,
			},
			ALL_STEPS,
		)

		expect(item).toEqual(
			expect.objectContaining({
				state: "draft",
				file_count: 1,
				missing_file_count: 2,
				rejected_file_count: 1,
				files_on_other_device: true,
			}),
		)
	})
})

describe("missing step of a draft CAP-014-R22", () => {
	it("CAP-015-R31 asks for images before anything else", () => {
		expect(recordMissingStepOf(acquisitionRow(), NO_PROGRESS, ALL_STEPS)).toBe("images")
	})

	it("CAP-015-R35 counts an announced file as an image the draft already has", () => {
		expect(recordMissingStepOf(acquisitionRow(), { ...NO_PROGRESS, announced_count: 1 }, ALL_STEPS)).toBe("finding")
	})

	it("CAP-017-R16 asks for the wound type of a located finding", () => {
		const draft = acquisitionRow({ finding_id: FINDING })

		expect(recordMissingStepOf(draft, { ...NO_PROGRESS, received_count: 1 }, ALL_STEPS)).toBe("wound_type")
	})

	it("CAP-017-R03 asks for the healing phase after the wound type", () => {
		const draft = acquisitionRow({ finding_id: FINDING })

		expect(recordMissingStepOf(draft, { ...NO_PROGRESS, received_count: 1, has_wound_type: true }, ALL_STEPS)).toBe(
			"healing_phase",
		)
	})

	it("CAP-017-S16 asks for the summary right after the location when the instance switched the clinical steps off", () => {
		const draft = acquisitionRow({ finding_id: FINDING })

		expect(recordMissingStepOf(draft, { ...NO_PROGRESS, received_count: 1 }, LOCATION_ONLY)).toBe("summary")
	})

	it("CAP-015-R36 asks for the files while a rejected file waits for its replacement", () => {
		const draft = acquisitionRow({ finding_id: FINDING })
		const progress = { ...NO_PROGRESS, received_count: 1, rejected_count: 1, has_wound_type: true }

		expect(recordMissingStepOf(draft, { ...progress, has_healing_phase: true }, ALL_STEPS)).toBe("files")
	})

	it("CAP-014-R14 asks for the summary of a complete draft", () => {
		const draft = acquisitionRow({ finding_id: FINDING })
		const progress = { ...NO_PROGRESS, received_count: 2, has_wound_type: true, has_healing_phase: true }

		expect(recordMissingStepOf(draft, progress, ALL_STEPS)).toBe("summary")
	})

	it("CAP-018-R15 asks a scanned document for its title after the pages", () => {
		const scan = acquisitionRow({ kind: ACQUISITION_KIND.SCAN })

		expect(recordMissingStepOf(scan, NO_PROGRESS, ALL_STEPS)).toBe("pages")
		expect(recordMissingStepOf(scan, { ...NO_PROGRESS, received_count: 1 }, ALL_STEPS)).toBe("document_title")
		expect(recordMissingStepOf(scan, { ...NO_PROGRESS, received_count: 1, has_document_title: true }, ALL_STEPS)).toBe(
			"summary",
		)
	})
})
