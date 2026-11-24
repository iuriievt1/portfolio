import { localizedNameOf } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { BodyDiagramRegion, LocalizedNames } from "../../../api/code-lists"
import type { BodySite } from "../../../api/findings"
import cs from "../../../i18n/cs.json"
import en from "../../../i18n/en.json"
import { layeredTexts } from "../../../i18n/texts"
import { bodySiteDetailOf, woundPlaceOf } from "../body-site-text"

const THIGH: BodySite = {
	region_code: "11207009",
	laterality: "L",
	view: "anterior",
	x: 0.55,
	y: 0.62,
	body_diagram_version: "1",
}
const SACRUM: BodySite = { ...THIGH, region_code: "51027004", laterality: null, view: "posterior" }
const REGIONS: BodyDiagramRegion[] = [
	{
		code: THIGH.region_code,
		name: "Stehno",
		names: { cs: "Stehno", en: "Thigh" },
		views: ["anterior", "posterior"],
		is_paired: true,
	},
]
const ENGLISH = layeredTexts(cs.language, [en.language])

function namesIn(language: string) {
	return (names: LocalizedNames) => localizedNameOf(names, language, cs.language)
}

describe("body site in words", () => {
	it("CAP-016-S13 names the patient's side and the view", () => {
		expect(bodySiteDetailOf(THIGH, cs)).toBe("levá strana pacienta · zepředu")
		expect(bodySiteDetailOf(THIGH, ENGLISH)).toBe("patient's left side · from the front")
	})

	it("CAP-016-R11 leaves the side out for an unpaired region", () => {
		expect(bodySiteDetailOf(SACRUM, cs)).toBe("zezadu")
	})

	it("CAP-016-R19 tells the two side views apart for an unpaired region", () => {
		expect(bodySiteDetailOf({ ...SACRUM, view: "right_lateral" }, cs)).toBe("z pravého boku")
		expect(bodySiteDetailOf({ ...SACRUM, view: "left_lateral" }, cs)).toBe("z levého boku")
		expect(bodySiteDetailOf({ ...SACRUM, view: "right_lateral" }, ENGLISH)).toBe("from the right side")
		expect(bodySiteDetailOf({ ...SACRUM, view: "left_lateral" }, ENGLISH)).toBe("from the left side")
	})

	it("CAP-016-S12 names the region in the language of the interface", () => {
		expect(woundPlaceOf(THIGH, REGIONS, namesIn(en.language), ENGLISH)).toEqual({
			region: "Thigh",
			detail: "patient's left side · from the front",
		})
		expect(woundPlaceOf(THIGH, REGIONS, namesIn(cs.language), cs).region).toBe("Stehno")
	})

	it("CAP-016-R18 leaves the region out when the code list does not know it", () => {
		expect(woundPlaceOf(SACRUM, REGIONS, namesIn(cs.language), cs)).toEqual({ region: undefined, detail: "zezadu" })
	})
})
