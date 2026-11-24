import { describe, expect, it } from "vitest"
import { numberElement, textElement, textValuesElement } from "../elements"

// DICOM PS3.5 6.1.2.1, 6.2
describe("DICOM elements", () => {
	it("writes an empty value as no value and keeps the encoded VRs in UTF-8", () => {
		expect(textElement("PN", "")).toEqual({ vr: "PN", Value: [] })
		expect(textElement("LO", "Rána 2")).toEqual({ vr: "LO", Value: ["Rána 2"] })
		expect(textValuesElement("CS", ["DERIVED", "PRIMARY"])).toEqual({ vr: "CS", Value: ["DERIVED", "PRIMARY"] })
	})

	it.each([
		["a CS with a letter outside the default repertoire", () => textElement("CS", "HLAVA_Č")],
		["a UI with a control character", () => textElement("UI", "2.25.1\u0000")],
		[
			"a multi-valued CS with a letter outside the default repertoire",
			() => textValuesElement("CS", ["ORIGINAL", "Č"]),
		],
		["a US over 65535", () => numberElement("US", 65_536)],
		["a negative UL", () => numberElement("UL", -1)],
		["an IS that is not whole", () => numberElement("IS", 1.5)],
	])("refuses %s, which the DICOM library would write wrongly (negative)", (_, element) => {
		expect(element).toThrow()
	})
})
