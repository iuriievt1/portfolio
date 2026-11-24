import { describe, expect, it } from "vitest"
import cs from "../../../i18n/cs.json"
import {
	assessmentEyebrowOf,
	CAPTURE_STEP,
	type ClinicalSteps,
	clinicalStepsOf,
	stepAfterLocation,
	stepAfterWoundType,
} from "../clinical-steps"

const ALL_STEPS: ClinicalSteps = { woundType: true, healingPhase: true }
const LOCATION_ONLY: ClinicalSteps = { woundType: false, healingPhase: false }
const TYPE_AND_PHASE = "Typ rány · fáze hojení"

describe("clinical steps of the instance CAP-017-R16", () => {
	it("takes both steps as switched off when the configuration says nothing", () => {
		expect(clinicalStepsOf(undefined)).toEqual(LOCATION_ONLY)
		expect(clinicalStepsOf({ version: 1, allowed_login_methods: [] })).toEqual(LOCATION_ONLY)
	})

	it("reads both switches from the effective configuration", () => {
		expect(
			clinicalStepsOf({
				version: 1,
				allowed_login_methods: [],
				wound_type_enabled: true,
				healing_phase_enabled: false,
			}),
		).toEqual({ woundType: true, healingPhase: false })
	})
})

describe("step after the location CAP-015-R31", () => {
	it("asks a new wound for its type and an existing wound for its phase", () => {
		expect(stepAfterLocation(true, ALL_STEPS)).toBe(CAPTURE_STEP.WOUND_TYPE)
		expect(stepAfterLocation(false, ALL_STEPS)).toBe(CAPTURE_STEP.HEALING_PHASE)
		expect(stepAfterWoundType(ALL_STEPS)).toBe(CAPTURE_STEP.HEALING_PHASE)
	})

	it("CAP-017-S16 goes from the location straight to the summary when both steps are off", () => {
		expect(stepAfterLocation(true, LOCATION_ONLY)).toBe(CAPTURE_STEP.SUMMARY)
		expect(stepAfterLocation(false, LOCATION_ONLY)).toBe(CAPTURE_STEP.SUMMARY)
	})

	it("CAP-017-R16 skips only the step the instance switched off", () => {
		expect(stepAfterLocation(true, { woundType: false, healingPhase: true })).toBe(CAPTURE_STEP.HEALING_PHASE)
		expect(stepAfterWoundType({ woundType: true, healingPhase: false })).toBe(CAPTURE_STEP.SUMMARY)
	})
})

describe("eyebrow of the assessment CAP-017-R16", () => {
	it("names only the steps the instance offers", () => {
		expect(assessmentEyebrowOf(ALL_STEPS, TYPE_AND_PHASE, cs)).toBe(TYPE_AND_PHASE)
		expect(assessmentEyebrowOf({ woundType: true, healingPhase: false }, TYPE_AND_PHASE, cs)).toBe("Typ rány")
		expect(assessmentEyebrowOf({ woundType: false, healingPhase: true }, TYPE_AND_PHASE, cs)).toBe("Fáze hojení")
		expect(assessmentEyebrowOf(LOCATION_ONLY, TYPE_AND_PHASE, cs)).toBeUndefined()
	})
})
