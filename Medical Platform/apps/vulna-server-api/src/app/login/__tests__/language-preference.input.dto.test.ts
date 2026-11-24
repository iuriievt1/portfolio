import { describe, expect, it } from "vitest"
import { languagePreferenceSchema } from "../dto/language-preference.input.dto"

describe("languagePreferenceSchema", () => {
	it("accepts a BCP 47 code without surrounding spaces", () => {
		expect(languagePreferenceSchema.parse({ language: " en " })).toEqual({ language: "en" })
		expect(languagePreferenceSchema.parse({ language: "sr-Latn-RS" })).toEqual({ language: "sr-Latn-RS" })
	})

	it("refuses a code outside the contract pattern, a missing code and any other field", () => {
		expect(languagePreferenceSchema.safeParse({ language: "e" }).success).toBe(false)
		expect(languagePreferenceSchema.safeParse({ language: "english" }).success).toBe(false)
		expect(languagePreferenceSchema.safeParse({ language: "en_GB" }).success).toBe(false)
		expect(languagePreferenceSchema.safeParse({ language: null }).success).toBe(false)
		expect(languagePreferenceSchema.safeParse({}).success).toBe(false)
		expect(languagePreferenceSchema.safeParse({ language: "en", device: "tablet" }).success).toBe(false)
	})
})
