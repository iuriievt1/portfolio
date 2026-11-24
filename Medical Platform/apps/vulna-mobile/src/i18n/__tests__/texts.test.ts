import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { languageNameOf, layeredTexts, overlayTexts, RELEASE_LANGUAGES, RELEASE_TEXTS } from "../texts"

const CONFIGURATION_SCHEMA = resolve(__dirname, "../../../../../profiles/mou/configuration.schema.json")
const RELEASE_DEFAULT_LANGUAGE: string = JSON.parse(readFileSync(CONFIGURATION_SCHEMA, "utf8")).properties.localization
	.properties.default_language.default
const PLURAL_OTHER = "other"

function isGroup(value: unknown): value is object {
	return typeof value === "object" && value !== null && !(PLURAL_OTHER in value)
}

function keysOf(texts: object, prefix = ""): string[] {
	return Object.entries(texts).flatMap(([key, value]) => {
		const path = `${prefix}${key}`
		return isGroup(value) ? keysOf(value, `${path}.`) : [path]
	})
}

function valuesOf(texts: object): unknown[] {
	return Object.values(texts).flatMap((value) =>
		typeof value === "object" && value !== null ? valuesOf(value) : [value],
	)
}

describe("release texts", () => {
	const complete = keysOf(RELEASE_TEXTS[RELEASE_DEFAULT_LANGUAGE] ?? {})

	it.each(RELEASE_LANGUAGES)("CAP-015-R23 %s has the same keys as the default file", (language) => {
		expect(keysOf(RELEASE_TEXTS[language] ?? {})).toEqual(complete)
	})

	it.each(RELEASE_LANGUAGES)("CAP-015-R26 %s has no empty text", (language) => {
		expect(valuesOf(RELEASE_TEXTS[language] ?? {})).not.toContain("")
	})

	it("CAP-015-R23 names every language in its own file, so a new language needs no code", () => {
		expect(languageNameOf("cs")).toBe("Čeština")
		expect(languageNameOf("en")).toBe("English")
		expect(languageNameOf("de")).toBe("de")
	})
})

describe("layered texts", () => {
	it("CAP-015-R26 a missing text falls back alone", () => {
		const merged = overlayTexts({ heading: "Výchozí", body: "Výchozí text" }, { heading: "Current" })
		expect(merged).toEqual({ heading: "Current", body: "Výchozí text" })
	})

	it("CAP-015-R26 plural forms are replaced whole", () => {
		const merged = overlayTexts(
			{ count: { one: "{n} den", few: "{n} dny", other: "{n} dnů" } },
			{ count: { one: "{n} day", other: "{n} days" } },
		)
		expect(merged.count).toEqual({ one: "{n} day", other: "{n} days" })
	})

	it("CAP-015-R26 an unknown language keeps the complete file", () => {
		expect(layeredTexts(RELEASE_DEFAULT_LANGUAGE, ["xx"])).toEqual(RELEASE_TEXTS[RELEASE_DEFAULT_LANGUAGE])
	})
})
