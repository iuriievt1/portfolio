import { CONFIGURATION_KEY, PATIENT_TAG_SOURCE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import {
	choiceValueOf,
	integerValueOf,
	requiredChoiceOf,
	requiredIntegerOf,
	requiredTextOf,
	textValueOf,
} from "../values"

const SOURCES = Object.values(PATIENT_TAG_SOURCE)
const values = new Map<string, unknown>([
	[CONFIGURATION_KEY.PATIENT_CODE_SYSTEM, "  mou-nis  "],
	[CONFIGURATION_KEY.MAX_DRAFT_ACQUISITIONS, 20],
	[CONFIGURATION_KEY.PATIENT_TAG_SOURCE, PATIENT_TAG_SOURCE.UID],
])

describe("typed configuration values", () => {
	it("trims a text and treats a blank one as unset", () => {
		expect(textValueOf(values, CONFIGURATION_KEY.PATIENT_CODE_SYSTEM)).toBe("mou-nis")
		expect(
			textValueOf(new Map([[CONFIGURATION_KEY.PATIENT_CODE_SYSTEM, "   "]]), CONFIGURATION_KEY.PATIENT_CODE_SYSTEM),
		).toBe(undefined)
		expect(requiredTextOf(values, CONFIGURATION_KEY.PATIENT_CODE_SYSTEM)).toBe("mou-nis")
		expect(() => requiredTextOf(new Map(), CONFIGURATION_KEY.PATIENT_CODE_SYSTEM)).toThrow(
			CONFIGURATION_KEY.PATIENT_CODE_SYSTEM,
		)
	})

	it("accepts only whole numbers", () => {
		expect(integerValueOf(values, CONFIGURATION_KEY.MAX_DRAFT_ACQUISITIONS)).toBe(20)
		expect(
			integerValueOf(
				new Map([[CONFIGURATION_KEY.MAX_DRAFT_ACQUISITIONS, 2.5]]),
				CONFIGURATION_KEY.MAX_DRAFT_ACQUISITIONS,
			),
		).toBe(undefined)
		expect(requiredIntegerOf(values, CONFIGURATION_KEY.MAX_DRAFT_ACQUISITIONS)).toBe(20)
		expect(() => requiredIntegerOf(new Map(), CONFIGURATION_KEY.MAX_DRAFT_ACQUISITIONS)).toThrow(
			CONFIGURATION_KEY.MAX_DRAFT_ACQUISITIONS,
		)
	})

	it("accepts only an allowed choice", () => {
		expect(choiceValueOf(values, CONFIGURATION_KEY.PATIENT_TAG_SOURCE, SOURCES)).toBe(PATIENT_TAG_SOURCE.UID)
		expect(
			choiceValueOf(
				new Map([[CONFIGURATION_KEY.PATIENT_TAG_SOURCE, "serial"]]),
				CONFIGURATION_KEY.PATIENT_TAG_SOURCE,
				SOURCES,
			),
		).toBe(undefined)
		expect(requiredChoiceOf(values, CONFIGURATION_KEY.PATIENT_TAG_SOURCE, SOURCES)).toBe(PATIENT_TAG_SOURCE.UID)
		expect(() => requiredChoiceOf(new Map(), CONFIGURATION_KEY.PATIENT_TAG_SOURCE, SOURCES)).toThrow(
			CONFIGURATION_KEY.PATIENT_TAG_SOURCE,
		)
	})
})
