import { describe, expect, it } from "vitest"
import { importTranslations, type KnownNames, TRANSLATION_ROW_REJECTION } from "../translation-import"

const KNOWN: KnownNames = new Map([
	[
		"wound-type",
		new Map<string, Readonly<Record<string, string>>>([
			["leg-ulcer", { cs: "Bércový vřed", en: "Leg ulcer" }],
			["burn", { cs: "Popálenina", de: "Verbrennung" }],
		]),
	],
])

describe("translations imported by stable code CAP-017-R18", () => {
	it("CAP-017-S09 writes the new names and counts the unchanged ones", () => {
		const result = importTranslations(KNOWN, "de", [
			{ codeListCode: "wound-type", code: "leg-ulcer", name: " Ulcus cruris " },
			{ codeListCode: "wound-type", code: "burn", name: "Verbrennung" },
		])

		expect(result).toEqual({
			ok: true,
			writes: [{ codeListCode: "wound-type", code: "leg-ulcer", name: "Ulcus cruris" }],
			unchangedCount: 1,
		})
	})

	it("refuses the whole import and names every bad row", () => {
		const result = importTranslations(KNOWN, "de", [
			{ codeListCode: "wound-type", code: "leg-ulcer", name: "Ulcus cruris" },
			{ codeListCode: "wound-type", code: "unknown", name: "X" },
			{ codeListCode: "healing-phase", code: "leg-ulcer", name: "X" },
			{ codeListCode: "wound-type", code: "leg-ulcer", name: "Ulkus" },
			{ codeListCode: "wound-type", code: "burn", name: "  " },
		])

		expect(result).toEqual({
			ok: false,
			rejectedRows: [
				{ row: 2, code: TRANSLATION_ROW_REJECTION.ITEM_UNKNOWN },
				{ row: 3, code: TRANSLATION_ROW_REJECTION.ITEM_UNKNOWN },
				{ row: 4, code: TRANSLATION_ROW_REJECTION.DUPLICATE_ITEM },
				{ row: 5, code: TRANSLATION_ROW_REJECTION.NAME_MISSING },
			],
		})
	})
})
