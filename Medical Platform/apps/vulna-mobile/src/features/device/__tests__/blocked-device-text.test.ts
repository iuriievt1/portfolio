import { describe, expect, it } from "vitest"
import cs from "../../../i18n/cs.json"
import { layeredTexts } from "../../../i18n/texts"
import { blockedBodyOf } from "../blocked-device-text"

const en = layeredTexts("cs", ["en"])

describe("text of the block on a registered device", () => {
	it("CAP-008-S07 E10 names the lost records in Czech in the right form", () => {
		expect(blockedBodyOf(cs, 1)).toBe(
			"Byl zjištěn zásah do operačního systému. Data aplikace včetně 1 neodeslaného záznamu byla smazána.",
		)
		expect(blockedBodyOf(cs, 3)).toBe(
			"Byl zjištěn zásah do operačního systému. Data aplikace včetně 3 neodeslaných záznamů byla smazána.",
		)
		expect(blockedBodyOf(cs, 12)).toBe(
			"Byl zjištěn zásah do operačního systému. Data aplikace včetně 12 neodeslaných záznamů byla smazána.",
		)
	})

	it("CAP-015-R22 names the lost records in English", () => {
		expect(blockedBodyOf(en, 1)).toBe(
			"A change to the operating system was found. The data of the app including 1 unsent record was deleted.",
		)
		expect(blockedBodyOf(en, 4)).toBe(
			"A change to the operating system was found. The data of the app including 4 unsent records was deleted.",
		)
	})

	it("says only that the data was deleted when nothing was lost or the count is unknown", () => {
		expect(blockedBodyOf(cs, 0)).toBe(cs.device.blockedRegistered.body)
		expect(blockedBodyOf(cs, undefined)).toBe(cs.device.blockedRegistered.body)
	})
})
