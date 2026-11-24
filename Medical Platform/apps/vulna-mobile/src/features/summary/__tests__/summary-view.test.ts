import { localizedNameOf } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import type { CodeListSet, LocalizedNames } from "../../../api/code-lists"
import cs from "../../../i18n/cs.json"
import { formatDate, formatTime } from "../../../utils/format-date"
import type { ClinicalSteps } from "../../assessment/clinical-steps"
import { latestDraftOf, summaryViewOf } from "../summary-view"

const nameOf = (names: LocalizedNames) => localizedNameOf(names, "cs", "cs")

const BODY_SITE = {
	region_code: "11207009",
	laterality: "L",
	view: "anterior",
	x: 0.55,
	y: 0.62,
	body_diagram_version: "1",
} as const

const CODE_LISTS: CodeListSet = {
	version: "7",
	wound_types: [
		{ code: "leg-ulcer", text: "Bércový vřed", names: { cs: "Bércový vřed" }, is_selectable: true },
		{ code: "old-type", text: "Starý typ", names: { cs: "Starý typ" }, is_selectable: false },
	],
	healing_phases: [{ code: "granulating", text: "Granulační", names: { cs: "Granulační" }, is_selectable: true }],
	document_titles: [],
	body_diagram: {
		version: "1",
		regions: [{ code: "11207009", name: "Stehno", names: { cs: "Stehno" }, views: ["anterior"], is_paired: true }],
	},
}

const OPENED_AT = new Date("2026-10-08T09:10:00")

function draft(change: Partial<AcquisitionDraft> = {}): AcquisitionDraft {
	return {
		acquisition_id: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10",
		idempotency_key: "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50",
		state: "draft",
		kind: "photo",
		patient: {} as AcquisitionDraft["patient"],
		finding_id: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a",
		wound_type_code: "leg-ulcer",
		body_site: BODY_SITE,
		assessment: { healing_phase_code: "granulating", code_list_version: "7" },
		operator_user_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
		started_at: "2026-10-08T09:00:00Z",
		updated_at: "2026-10-08T09:05:00Z",
		version: 3,
		files: [],
		...change,
	}
}

const ALL_STEPS: ClinicalSteps = { woundType: true, healingPhase: true }

describe("summary", () => {
	it("CAP-016-S13 CAP-017-S01 shows the wound in words and the type and phase the server holds", () => {
		const view = summaryViewOf(
			{ draft: draft(), codeLists: CODE_LISTS, openedAt: OPENED_AT, steps: ALL_STEPS },
			nameOf,
			cs,
		)

		expect(view.visit).toBe(`${formatDate(OPENED_AT, cs.language)} · ${formatTime(OPENED_AT, cs.language)}`)
		expect(view.wound).toEqual({ region: "Stehno", detail: "levá strana pacienta · zepředu" })
		expect(view.assessment).toEqual({ eyebrow: "Typ rány · fáze hojení", value: "Bércový vřed · granulační" })
		expect(view.note).toBeUndefined()
	})

	it("CAP-017-R08 keeps the name of a withdrawn type the finding still carries", () => {
		const view = summaryViewOf(
			{ draft: draft({ wound_type_code: "old-type" }), codeLists: CODE_LISTS, openedAt: OPENED_AT, steps: ALL_STEPS },
			nameOf,
			cs,
		)

		expect(view.assessment?.value).toBe("Starý typ · granulační")
	})

	it("CAP-017-R04 shows the note of the record", () => {
		const noted = draft({
			assessment: { healing_phase_code: "granulating", code_list_version: "7", description: "Klidné okraje" },
		})

		expect(
			summaryViewOf({ draft: noted, codeLists: CODE_LISTS, openedAt: OPENED_AT, steps: ALL_STEPS }, nameOf, cs).note,
		).toBe("Klidné okraje")
	})

	it("CAP-017-R04 leaves type, phase and note empty for a draft without assessment", () => {
		const view = summaryViewOf(
			{ draft: draft({ assessment: undefined }), codeLists: CODE_LISTS, openedAt: OPENED_AT, steps: ALL_STEPS },
			nameOf,
			cs,
		)

		expect(view.assessment?.value).toBeUndefined()
		expect(view.note).toBeUndefined()
	})

	it("CAP-017-S16 leaves out the type and phase the instance switched off and keeps the note", () => {
		const noted = draft({ wound_type_code: null, assessment: { description: "Klidné okraje" } })
		const steps = { woundType: false, healingPhase: false }

		const view = summaryViewOf({ draft: noted, codeLists: CODE_LISTS, openedAt: OPENED_AT, steps }, nameOf, cs)

		expect(view.assessment).toBeUndefined()
		expect(view.note).toBe("Klidné okraje")
	})

	it("CAP-017-R16 shows the healing phase alone when the instance switched the wound type off", () => {
		const steps = { woundType: false, healingPhase: true }

		const view = summaryViewOf({ draft: draft(), codeLists: CODE_LISTS, openedAt: OPENED_AT, steps }, nameOf, cs)

		expect(view.assessment).toEqual({ eyebrow: "Fáze hojení", value: "Granulační" })
	})

	it("CAP-021-R32 prefers the newer version of the same record", () => {
		const loaded = draft({ version: 3 })
		const saved = draft({ version: 4 })

		expect(latestDraftOf(saved, loaded)).toBe(saved)
		expect(latestDraftOf(undefined, loaded)).toBe(loaded)
		expect(latestDraftOf(draft({ version: 2 }), loaded)).toBe(loaded)
	})

	it("CAP-021-R32 ignores a newer version of another record", () => {
		const loaded = draft({ version: 3 })
		const other = draft({ acquisition_id: "7e6d5c4b-3a29-4f18-8e07-f6e5d4c3b2a1", version: 9 })

		expect(latestDraftOf(other, loaded)).toBe(loaded)
	})
})
