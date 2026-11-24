import { MISSING_STEP } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { firstWoundStepOf, WOUND_STEP } from "../wound-step"

describe("step offered by E107", () => {
	it("CAP-015-R31 E107 offers to mark the wound location when it is missing first", () => {
		expect(firstWoundStepOf([MISSING_STEP.IMAGES, MISSING_STEP.BODY_SITE, MISSING_STEP.HEALING_PHASE])).toBe(
			WOUND_STEP.LOCATION,
		)
		expect(firstWoundStepOf([MISSING_STEP.FINDING])).toBe(WOUND_STEP.LOCATION)
	})

	it("CAP-015-R31 E107 offers to add the healing phase once the location is known", () => {
		expect(firstWoundStepOf([MISSING_STEP.WOUND_TYPE, MISSING_STEP.HEALING_PHASE])).toBe(WOUND_STEP.ASSESSMENT)
		expect(firstWoundStepOf([MISSING_STEP.HEALING_PHASE])).toBe(WOUND_STEP.ASSESSMENT)
	})

	it("CAP-018-R15 offers no wound step for a document", () => {
		expect(firstWoundStepOf([MISSING_STEP.PAGES, MISSING_STEP.DOCUMENT_TITLE])).toBeUndefined()
		expect(firstWoundStepOf([])).toBeUndefined()
	})
})
