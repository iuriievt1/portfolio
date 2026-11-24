import { describe, expect, it } from "vitest"
import type { BodyDiagramRegion, LocalizedNames } from "../../../api/code-lists"
import type { BodySite, Finding } from "../../../api/findings"
import cs from "../../../i18n/cs.json"
import { layeredTexts, overlayTexts } from "../../../i18n/texts"
import type { ClinicalSteps } from "../../assessment/clinical-steps"
import { typeAndPhaseOf, woundPeriodOf, woundPlaceLineOf, woundTitleOf } from "../wound-view"

const REGIONS: BodyDiagramRegion[] = [
	{ code: "shin", name: "Bérec", names: { cs: "Bérec", en: "Shin" }, views: ["anterior"], is_paired: true },
	{ code: "sacrum", name: "Kříž", names: { cs: "Kříž", en: "Sacrum" }, views: ["posterior"], is_paired: false },
]

const ENGLISH = layeredTexts("cs", ["en"])

const czechName = (names: LocalizedNames) => names.cs ?? ""
const englishName = (names: LocalizedNames) => names.en ?? ""

function site(change: Partial<BodySite>): BodySite {
	return {
		region_code: "shin",
		laterality: "R",
		view: "anterior",
		x: 0.4,
		y: 0.7,
		body_diagram_version: "1",
		...change,
	}
}

describe("woundTitleOf", () => {
	it("CAP-016-R19 names the wound by its region and the patient's side", () => {
		expect(woundTitleOf(site({}), REGIONS, czechName, cs)).toBe("Bérec · pravá strana pacienta")
		expect(woundTitleOf(site({ laterality: "L" }), REGIONS, englishName, ENGLISH)).toBe("Shin · patient's left side")
	})

	it("CAP-016-R11 leaves out the side of an unpaired region", () => {
		expect(woundTitleOf(site({ region_code: "sacrum", laterality: null }), REGIONS, czechName, cs)).toBe("Kříž")
	})

	it("CAP-016-R18 never shows a region code the code list does not know", () => {
		expect(woundTitleOf(site({ region_code: "unknown" }), REGIONS, czechName, cs)).toBe("Rána")
		expect(woundTitleOf(undefined, REGIONS, czechName, cs)).toBe("Rána")
	})
})

describe("woundPlaceLineOf", () => {
	it("CAP-016-S13 describes the place with the region, the side and the view", () => {
		expect(woundPlaceLineOf(site({}), REGIONS, czechName, cs)).toBe("Bérec · pravá strana pacienta · zepředu")
	})
})

const ALL_STEPS: ClinicalSteps = { woundType: true, healingPhase: true }

describe("typeAndPhaseOf", () => {
	it("CAP-017-R02 joins the wound type with the healing phase", () => {
		expect(typeAndPhaseOf("Bércový vřed", "Granulační", ALL_STEPS, cs)).toBe("Bércový vřed · granulační")
		expect(typeAndPhaseOf("Bércový vřed", undefined, ALL_STEPS, cs)).toBe("Bércový vřed")
		expect(typeAndPhaseOf(undefined, undefined, ALL_STEPS, cs)).toBeUndefined()
	})

	it("CAP-017-S16 leaves out the type and phase the instance switched off", () => {
		expect(typeAndPhaseOf("Bércový vřed", "Granulační", { woundType: false, healingPhase: true }, cs)).toBe(
			"Granulační",
		)
		expect(typeAndPhaseOf("Bércový vřed", "Granulační", { woundType: true, healingPhase: false }, cs)).toBe(
			"Bércový vřed",
		)
		expect(typeAndPhaseOf("Bércový vřed", "Granulační", { woundType: false, healingPhase: false }, cs)).toBeUndefined()
	})
})

describe("woundPeriodOf", () => {
	it("CAP-015-R28 shows since when and when last without the year", () => {
		const finding: Finding = {
			finding_id: "finding",
			patient_id: "patient",
			number: 1,
			created_at: "2026-08-14T06:58:00Z",
			last_acquisition: "2026-09-12T07:10:00Z",
		}
		expect(woundPeriodOf(finding, cs)).toBe("od 14. 8. · naposledy 12. 9.")
		expect(woundPeriodOf(finding, ENGLISH)).toBe("since 8/14 · last 9/12")
	})
})

describe("typeAndPhaseOf letter case", () => {
	it("CAP-015-R23 takes the letter case of the phase from the language file", () => {
		const original = overlayTexts(cs, { textCase: { phaseAfterType: "original" } })
		expect(typeAndPhaseOf("Bércový vřed", "Granulační", ALL_STEPS, original)).toBe("Bércový vřed · Granulační")
	})
})
