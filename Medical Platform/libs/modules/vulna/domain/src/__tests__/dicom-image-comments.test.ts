import { BODY_VIEW, LATERALITY } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { DICOM_MAPPING_FAILURE } from "../dicom/mapping-error"
import { paddedLengthOf } from "../dicom/value-representation"
import { dicomImageCommentsOf, type TrackedWound, type WoundAssessment } from "../dicom/wound"

const WOUND: TrackedWound = {
	findingId: "00000000-0000-4000-8000-000000000002",
	woundNumber: 2,
	bodySite: {
		regionCode: "699915001",
		laterality: LATERALITY.LEFT,
		view: BODY_VIEW.ANTERIOR,
		x: 0.5,
		y: 0.5,
		bodyDiagramVersion: "2",
	},
}

const PLACE = "Rána 2 · Dolní část hrudní stěny (pod prsem) · levá strana pacienta · zepředu"
const PRESSURE_INJURY = { cs: "Dekubitus", en: "Pressure injury" }
const GRANULATION = { cs: "Granulační", en: "Granulation" }
const NOTHING_ASSESSED: WoundAssessment = {
	woundTypeNames: undefined,
	healingPhaseNames: undefined,
	description: undefined,
}
const LONG_TEXT_MAX_LENGTH = 10_240

// integrace-dicom.md 5.4
describe("DICOM Image Comments of a wound", () => {
	it("CAP-021-R15 carries the place, the wound type, the healing phase and the free text", () => {
		const assessment = { woundTypeNames: PRESSURE_INJURY, healingPhaseNames: GRANULATION, description: "Okraje klidné" }
		expect(dicomImageCommentsOf(WOUND, assessment, "cs")).toBe(
			`${PLACE}\r\nTyp rány: Dekubitus\r\nFáze hojení: Granulační\r\nOkraje klidné`,
		)
	})

	it("CAP-021-R26 writes the names and words in the language of the instance", () => {
		const assessment = { ...NOTHING_ASSESSED, woundTypeNames: PRESSURE_INJURY, healingPhaseNames: GRANULATION }
		expect(dicomImageCommentsOf(WOUND, assessment, "en")).toBe(
			"Wound 2 · Skin of lower chest wall · patient's left side · from the front\r\n" +
				"Wound type: Pressure injury\r\nHealing phase: Granulation",
		)
	})

	it("CAP-017-R16 leaves out what the instance switched off or the record does not carry", () => {
		const phaseOnly = { ...NOTHING_ASSESSED, healingPhaseNames: GRANULATION }
		expect(dicomImageCommentsOf(WOUND, NOTHING_ASSESSED, "cs")).toBe(PLACE)
		expect(dicomImageCommentsOf(WOUND, { ...NOTHING_ASSESSED, description: "" }, "cs")).toBe(PLACE)
		expect(dicomImageCommentsOf(WOUND, phaseOnly, "cs")).toBe(`${PLACE}\r\nFáze hojení: Granulační`)
	})

	it("CAP-021-R26 keeps the free text as it was written", () => {
		const description = "první řádek\ndruhý\tsloupec \\ lomítko"
		expect(dicomImageCommentsOf(WOUND, { ...NOTHING_ASSESSED, description }, "cs")).toBe(`${PLACE}\r\n${description}`)
	})

	it("CAP-017-R17 shortens a free text that does not fit and marks it", () => {
		const description = "x".repeat(LONG_TEXT_MAX_LENGTH)
		const comments = dicomImageCommentsOf(WOUND, { ...NOTHING_ASSESSED, description }, "cs")
		expect(paddedLengthOf(comments)).toBeLessThanOrEqual(LONG_TEXT_MAX_LENGTH)
		expect(paddedLengthOf(comments)).toBeGreaterThanOrEqual(LONG_TEXT_MAX_LENGTH - 1)
		expect(comments.startsWith(`${PLACE}\r\nxxx`)).toBe(true)
		expect(comments.endsWith("x…")).toBe(true)
	})

	it("CAP-021-R26 refuses a name it does not have in the language of the instance (negative)", () => {
		const assessment = { ...NOTHING_ASSESSED, woundTypeNames: { en: "Pressure injury" } }
		expect(() => dicomImageCommentsOf(WOUND, assessment, "cs")).toThrow(
			expect.objectContaining({ failure: DICOM_MAPPING_FAILURE.UNSUPPORTED_LANGUAGE }),
		)
	})

	it.each([
		["a control character", "zvonek \u0007"],
		["a vertical tab", "a\u000bb"],
		["an escape, which ISO_IR 192 does not use", "\u001b[0m"],
		["a C1 control character", "konec\u0085"],
		["a broken character", "a\uDC00b"],
	])("integrace-dicom.md 5.4 refuses free text with %s (negative)", (_, description) => {
		expect(() => dicomImageCommentsOf(WOUND, { ...NOTHING_ASSESSED, description }, "cs")).toThrow(
			expect.objectContaining({ failure: DICOM_MAPPING_FAILURE.INVALID_VALUE }),
		)
	})
})
