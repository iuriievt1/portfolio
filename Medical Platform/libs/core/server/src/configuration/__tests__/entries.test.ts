import { describe, expect, it } from "vitest"
import { configurationEntries, configurationSections } from "../entries"

const sections = {
	mobile_app: { minimum_version: null, queue_max_items: 500 },
	localization: { supported_languages: ["cs", "en"] },
}

describe("configuration keys", () => {
	it("flattens sections into section.key entries and keeps null and arrays as values", () => {
		expect(configurationEntries(sections)).toEqual([
			["mobile_app.minimum_version", null],
			["mobile_app.queue_max_items", 500],
			["localization.supported_languages", ["cs", "en"]],
		])
	})

	it("rebuilds the sections from the entries", () => {
		expect(configurationSections(configurationEntries(sections))).toEqual(sections)
	})

	it("refuses a section that is not an object and a key without a section", () => {
		expect(() => configurationEntries({ mobile_app: 5 })).toThrow("mobile_app")
		expect(() => configurationSections([["minimum_version", null]])).toThrow("minimum_version")
		expect(() => configurationSections([["mobile_app.", null]])).toThrow("mobile_app.")
	})
})
