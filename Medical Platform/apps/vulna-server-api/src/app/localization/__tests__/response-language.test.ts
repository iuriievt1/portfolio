import { describe, expect, it } from "vitest"
import { responseLanguage } from "../response-language"

const INSTANCE = { defaultLanguage: "cs", supportedLanguages: ["cs", "en"] }

describe("responseLanguage", () => {
	it("CAP-015-S32 a supported language answers in it", () => {
		expect(responseLanguage("en", INSTANCE)).toBe("en")
	})

	it("CAP-015-S33 an unsupported language answers in the default", () => {
		expect(responseLanguage("de", INSTANCE)).toBe("cs")
	})

	it("CAP-015-R27 a missing header answers in the default", () => {
		expect(responseLanguage(undefined, INSTANCE)).toBe("cs")
	})

	it("CAP-015-R27 the region is ignored", () => {
		expect(responseLanguage("EN-gb", INSTANCE)).toBe("en")
	})

	it("CAP-015-R27 weights decide the order", () => {
		expect(responseLanguage("de, cs;q=0.5, en;q=0.8", INSTANCE)).toBe("en")
	})

	it("CAP-015-R27 a zero weight excludes the language", () => {
		expect(responseLanguage("en;q=0, de", INSTANCE)).toBe("cs")
	})

	it("CAP-015-R27 equal weights keep the header order", () => {
		expect(responseLanguage("en;q=0.5, cs;q=0.5", INSTANCE)).toBe("en")
	})

	it("CAP-015-R27 a wildcard answers in the default", () => {
		expect(responseLanguage("*", INSTANCE)).toBe("cs")
	})
})
