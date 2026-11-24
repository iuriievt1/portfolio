import { describe, expect, it } from "vitest"
import { editableItemsOf, editedLanguagesOf, newItem, otherLanguagesOf, requestOf } from "../lib/code-list-editor"
import { codeListItemsSchema } from "../lib/code-list-items.schema"
import type { CodeListItem } from "../types/code-list.types"

const LANGUAGES = editedLanguagesOf("cs", ["cs", "en"])
const STORED: CodeListItem[] = [
	{ code: "burn", name: "Popálenina", names: { cs: "Popálenina", de: "Verbrennung" }, sequence: 2, is_active: true },
	{ code: "leg-ulcer", name: "Bércový vřed", names: { cs: "Bércový vřed", en: "Leg ulcer" }, sequence: 1 },
]

function storedItems() {
	const [legUlcer, burn] = editableItemsOf(STORED, LANGUAGES)
	if (legUlcer === undefined || burn === undefined) {
		throw new Error("the items are missing")
	}
	return { legUlcer, burn }
}

function issuePathsOf(values: unknown): string[] {
	const result = codeListItemsSchema("cs").safeParse(values)
	return result.error?.issues.map((issue) => issue.path.join(".")) ?? []
}

describe("code list items edited in the administration CAP-017-R18", () => {
	it("edits the default language, Czech and English once each, in the stored order", () => {
		const items = editableItemsOf(STORED, LANGUAGES)

		expect(LANGUAGES).toEqual(["cs", "en"])
		expect(items.map((item) => item.code)).toEqual(["leg-ulcer", "burn"])
		expect(items[1]?.names).toEqual({ cs: "Popálenina", en: "" })
		expect(otherLanguagesOf(items[1] ?? newItem(LANGUAGES), LANGUAGES)).toEqual(["de"])
	})

	it("puts another default language first and keeps Czech and English after it", () => {
		expect(editedLanguagesOf("de", ["cs", "en"])).toEqual(["de", "cs", "en"])
		expect(editedLanguagesOf("CS", ["cs", "en"])).toEqual(["CS", "en"])
	})

	it("keeps imported languages untouched and removes an English name the administrator cleared", () => {
		const { legUlcer, burn } = storedItems()

		const request = requestOf([{ ...legUlcer, names: { cs: "Bércový vřed", en: " " } }, burn], "cs", LANGUAGES)

		expect(request).toEqual([
			{ code: "leg-ulcer", name: "Bércový vřed", names: { en: null }, sequence: 1, is_active: true },
			{ code: "burn", name: "Popálenina", names: {}, sequence: 2, is_active: true },
		])
	})

	it("sends a new item, a withdrawn item and the order the administrator chose", () => {
		const { legUlcer, burn } = storedItems()
		const added = { ...newItem(LANGUAGES), code: " pressure-ulcer ", names: { cs: " Dekubit ", en: "Pressure ulcer" } }

		const request = requestOf([added, { ...burn, isActive: false }, legUlcer], "cs", LANGUAGES)

		expect(request).toEqual([
			{ code: "pressure-ulcer", name: "Dekubit", names: { en: "Pressure ulcer" }, sequence: 1, is_active: true },
			{ code: "burn", name: "Popálenina", names: {}, sequence: 2, is_active: false },
			{ code: "leg-ulcer", name: "Bércový vřed", names: { en: "Leg ulcer" }, sequence: 3, is_active: true },
		])
	})

	it("CAP-017-S08 refuses a new item without a name in the default language", () => {
		const added = { ...newItem(LANGUAGES), code: "pressure-ulcer", names: { cs: " ", en: "Pressure ulcer" } }

		expect(issuePathsOf({ items: [added] })).toEqual(["items.0.names.cs"])
	})

	it("CAP-017-R08 refuses a new code that is not lower case words joined by hyphens", () => {
		const added = { ...newItem(LANGUAGES), code: "Leg Ulcer", names: { cs: "Bércový vřed", en: "" } }

		expect(issuePathsOf({ items: [added] })).toEqual(["items.0.code"])
	})

	it("CAP-017-R08 refuses a code the list already has", () => {
		const { legUlcer, burn } = storedItems()
		const duplicate = { ...newItem(LANGUAGES), code: "burn", names: { cs: "Spálenina", en: "" } }

		expect(issuePathsOf({ items: [legUlcer, burn, duplicate] })).toEqual(["items.2.code"])
	})

	it("CAP-017-R08 marks the new item, not the stored one, when the new item is moved above it", () => {
		const { legUlcer, burn } = storedItems()
		const duplicate = { ...newItem(LANGUAGES), code: "burn", names: { cs: "Spálenina", en: "" } }

		expect(issuePathsOf({ items: [duplicate, legUlcer, burn] })).toEqual(["items.0.code"])
	})
})
