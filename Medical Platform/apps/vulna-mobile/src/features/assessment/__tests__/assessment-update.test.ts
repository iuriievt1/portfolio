import { describe, expect, it } from "vitest"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import { healingPhaseUpdateOf, noteUpdateOf, woundTypeUpdateOf } from "../assessment-update"

function draft(change: Partial<AcquisitionDraft> = {}): AcquisitionDraft {
	return {
		acquisition_id: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10",
		idempotency_key: "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50",
		state: "draft",
		kind: "photo",
		patient: {} as AcquisitionDraft["patient"],
		operator_user_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
		started_at: "2026-10-08T09:00:00Z",
		updated_at: "2026-10-08T09:05:00Z",
		version: 3,
		files: [],
		...change,
	}
}

describe("wound type and healing phase sent with one tap CAP-017-R19", () => {
	it("CAP-017-S01 sends the chosen wound type with the code list version", () => {
		expect(woundTypeUpdateOf(draft(), "leg-ulcer", "7")).toEqual({
			wound_type_code: "leg-ulcer",
			code_list_version: "7",
		})
	})

	it("CAP-017-S12 sends nothing when the tapped item is the one already chosen", () => {
		expect(woundTypeUpdateOf(draft({ wound_type_code: "leg-ulcer" }), "leg-ulcer", "7")).toBeUndefined()
		expect(
			healingPhaseUpdateOf(
				draft({ assessment: { healing_phase_code: "granulating", code_list_version: "7" } }),
				"granulating",
				"7",
			),
		).toBeUndefined()
	})

	it("CAP-017-R03 sends the healing phase without touching the note", () => {
		expect(healingPhaseUpdateOf(draft(), "sloughy", "7")).toEqual({
			assessment: { healing_phase_code: "sloughy", code_list_version: "7" },
		})
	})
})

describe("note of the record CAP-017-R04", () => {
	const phased = draft({ assessment: { healing_phase_code: "granulating", code_list_version: "6" } })

	it("sends the note with the phase the record holds", () => {
		expect(noteUpdateOf(phased, "  Klidné okraje ")).toEqual({
			assessment: { healing_phase_code: "granulating", code_list_version: "6", description: "Klidné okraje" },
		})
	})

	it("CAP-017-R04 sends an empty note to clear it", () => {
		const noted = draft({
			assessment: { healing_phase_code: "granulating", code_list_version: "6", description: "Klidné okraje" },
		})

		expect(noteUpdateOf(noted, " ")).toEqual({
			assessment: { healing_phase_code: "granulating", code_list_version: "6", description: "" },
		})
	})

	it("sends nothing when the note did not change", () => {
		expect(noteUpdateOf(phased, "")).toBeUndefined()
	})

	it("CAP-017-S16 sends the note alone when the record has no healing phase", () => {
		expect(noteUpdateOf(draft(), " Klidné okraje")).toEqual({ assessment: { description: "Klidné okraje" } })
	})

	it("CAP-017-S16 sends nothing for an empty note on a record without assessment", () => {
		expect(noteUpdateOf(draft(), " ")).toBeUndefined()
	})
})
