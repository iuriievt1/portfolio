import { describe, expect, it, vi } from "vitest"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import { confirmedContentOf, contentFingerprintOf } from "../confirmed-content"

vi.mock("@ansora/core-mobile", () => ({
	cryptoAndKeys: () => ({ sha256Text: async (text: string) => `sha256(${text})` }),
}))

const BODY_SITE = {
	region_code: "11207009",
	laterality: "L",
	view: "anterior",
	x: 0.55,
	y: 0.62,
	body_diagram_version: "1",
} as const

function draft(change: Partial<AcquisitionDraft> = {}): AcquisitionDraft {
	return {
		acquisition_id: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10",
		idempotency_key: "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50",
		state: "draft",
		kind: "photo",
		patient: { patient_id: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a" } as AcquisitionDraft["patient"],
		finding_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
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

describe("confirmed content of a record CAP-021-R32", () => {
	it("CAP-021-R32 CAP-019-R29 notices a description, a place, a type or a title changed on another device", () => {
		const confirmed = confirmedContentOf(draft())

		expect(
			confirmedContentOf(draft({ assessment: { healing_phase_code: "epithelial", code_list_version: "7" } })),
		).not.toBe(confirmed)
		expect(confirmedContentOf(draft({ body_site: { ...BODY_SITE, x: 0.4 } }))).not.toBe(confirmed)
		expect(confirmedContentOf(draft({ wound_type_code: "burn" }))).not.toBe(confirmed)
		expect(confirmedContentOf(draft({ document_title: { text: "Propouštěcí zpráva" } }))).not.toBe(confirmed)
	})

	it("CAP-019-S20 does not count uploaded files, the version or the moment of the change", () => {
		const uploaded = draft({
			version: 9,
			updated_at: "2026-10-08T09:30:00Z",
			files: [{ file_key: "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50", sequence: 1, status: "received" }],
		})

		expect(confirmedContentOf(uploaded)).toBe(confirmedContentOf(draft()))
	})

	it("CAP-019-R29 keeps the same content whatever order the server sends the fields in", () => {
		const reordered = {
			body_diagram_version: "1",
			y: 0.62,
			x: 0.55,
			view: "anterior",
			laterality: "L",
			region_code: "11207009",
		} as const

		expect(confirmedContentOf(draft({ body_site: reordered }))).toBe(confirmedContentOf(draft()))
	})

	it("CAP-019-R10 takes the SHA-256 of the confirmed content as its fingerprint", async () => {
		expect(await contentFingerprintOf(draft())).toBe(`sha256(${confirmedContentOf(draft())})`)
	})
})
