import { describe, expect, it } from "vitest"
import type { Finding } from "../../../api/findings"
import cs from "../../../i18n/cs.json"
import { formatDate } from "../../../utils/format-date"
import { type CaptureSession, NO_PREVIEWS, NO_SHOTS, WOUND_CHOICE } from "../../capture/capture-session"
import { lastPhaseOf } from "../last-phase"

const BODY_SITE = {
	region_code: "51027004",
	laterality: null,
	view: "posterior",
	x: 0.5,
	y: 0.52,
	body_diagram_version: "1",
} as const
const TAKEN_AT = "2026-09-12T08:00:00Z"
const FINDING: Finding = {
	finding_id: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a",
	patient_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
	number: 1,
	created_at: "2026-09-01T08:00:00Z",
	last_body_site: BODY_SITE,
	last_acquisition: TAKEN_AT,
	last_assessment: { healing_phase_code: "inflammatory", code_list_version: "7" },
}

function session(wound: CaptureSession["wound"]): CaptureSession {
	return {
		photos: [],
		shots: NO_SHOTS,
		previews: NO_PREVIEWS,
		isSeriesLoaded: true,
		draft: undefined,
		wound,
		isWoundCleared: false,
	}
}

describe("badge of the last healing phase", () => {
	it("CAP-017-S11 marks the phase the wound had last time with its date", () => {
		const badge = lastPhaseOf(session({ kind: WOUND_CHOICE.EXISTING, finding: FINDING, bodySite: BODY_SITE }), cs)

		expect(badge).toEqual({
			code: "inflammatory",
			text: `naposledy ${formatDate(new Date(TAKEN_AT), cs.language)}`,
		})
	})

	it("CAP-017-S11 shows no badge for a new wound", () => {
		expect(
			lastPhaseOf(session({ kind: WOUND_CHOICE.NEW, bodySite: BODY_SITE, findingKey: undefined }), cs),
		).toBeUndefined()
	})
})
