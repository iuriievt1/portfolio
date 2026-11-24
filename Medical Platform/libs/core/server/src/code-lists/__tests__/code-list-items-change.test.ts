import { describe, expect, it } from "vitest"
import { type CodeListItemState, itemsWithoutName } from "../code-list-item"
import { changeCodeListItems, type RequestedCodeListItem } from "../code-list-items-change"

const DEFAULT_LANGUAGE = "cs"

const LEG_ULCER: CodeListItemState = {
	code: "leg-ulcer",
	sequence: 1,
	isActive: true,
	names: { cs: "Bércový vřed", en: "Leg ulcer", de: "Ulcus cruris" },
}
const BURN: CodeListItemState = {
	code: "burn",
	sequence: 2,
	isActive: true,
	names: { cs: "Popálenina", en: "Burn" },
}

function requested(item: Partial<RequestedCodeListItem> & { code: string; name: string }): RequestedCodeListItem {
	return { names: undefined, sequence: undefined, isActive: undefined, ...item }
}

describe("code list items replaced from the administration CAP-017-R18", () => {
	it("CAP-017-S08 refuses an item without a name in the default language and changes nothing", () => {
		const change = changeCodeListItems(
			[LEG_ULCER],
			[
				requested({ code: "leg-ulcer", name: "Bércový vřed" }),
				requested({ code: "burn", name: " ", names: { en: "Burn" } }),
			],
			DEFAULT_LANGUAGE,
		)

		expect(change).toEqual({ ok: false, codesWithoutName: ["burn"] })
	})

	it("refuses a default language name in the map that differs from the name", () => {
		const change = changeCodeListItems(
			[],
			[requested({ code: "burn", name: "Popálenina", names: { cs: "Spálenina" } })],
			DEFAULT_LANGUAGE,
		)

		expect(change.ok).toBe(false)
	})

	it("refuses to remove the name in the default language", () => {
		const change = changeCodeListItems(
			[BURN],
			[requested({ code: "burn", name: "Popálenina", names: { cs: null } })],
			DEFAULT_LANGUAGE,
		)

		expect(change.ok).toBe(false)
	})

	it("keeps translations the request does not name, so an imported language survives a save", () => {
		const change = changeCodeListItems(
			[LEG_ULCER],
			[requested({ code: "leg-ulcer", name: "Bércový vřed", names: { en: "Venous leg ulcer" } })],
			DEFAULT_LANGUAGE,
		)

		expect(change).toMatchObject({
			ok: true,
			items: [{ code: "leg-ulcer", names: { cs: "Bércový vřed", en: "Venous leg ulcer", de: "Ulcus cruris" } }],
			changedNames: 1,
		})
	})

	it("removes a translation on null", () => {
		const change = changeCodeListItems(
			[LEG_ULCER],
			[requested({ code: "leg-ulcer", name: "Bércový vřed", names: { de: null } })],
			DEFAULT_LANGUAGE,
		)

		expect(change).toMatchObject({ ok: true, items: [{ names: { cs: "Bércový vřed", en: "Leg ulcer" } }] })
	})

	it("CAP-017-R08 withdraws an item the list leaves out instead of deleting it", () => {
		const change = changeCodeListItems(
			[LEG_ULCER, BURN],
			[requested({ code: "burn", name: "Popálenina" })],
			DEFAULT_LANGUAGE,
		)

		expect(change).toMatchObject({
			ok: true,
			items: [
				{ code: "burn", sequence: 1, isActive: true },
				{ code: "leg-ulcer", isActive: false, names: LEG_ULCER.names },
			],
		})
	})

	it("CAP-017-S02 renames an item under the same stable code", () => {
		const change = changeCodeListItems(
			[LEG_ULCER],
			[requested({ code: "leg-ulcer", name: "Bércový vřed (ulcus cruris)" })],
			DEFAULT_LANGUAGE,
		)

		expect(change).toMatchObject({ ok: true, changed: [{ code: "leg-ulcer" }], changedNames: 1 })
	})

	it("reports nothing changed when the request repeats the list", () => {
		const change = changeCodeListItems(
			[LEG_ULCER, BURN],
			[requested({ code: "leg-ulcer", name: "Bércový vřed" }), requested({ code: "burn", name: "Popálenina" })],
			DEFAULT_LANGUAGE,
		)

		expect(change).toMatchObject({ ok: true, changed: [], changedNames: 0 })
	})
})

describe("names missing in a language CAP-012-R28", () => {
	it("CAP-012-S19 lists active items without a name and skips withdrawn ones", () => {
		const withdrawn = { ...BURN, code: "old", isActive: false, names: { cs: "Stará" } }

		expect(itemsWithoutName([LEG_ULCER, { ...BURN, names: { cs: "Popálenina" } }, withdrawn], "EN")).toEqual([
			{ ...BURN, names: { cs: "Popálenina" } },
		])
	})
})
