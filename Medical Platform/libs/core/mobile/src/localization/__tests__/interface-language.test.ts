import { describe, expect, it } from "vitest"
import { defaultLanguage, interfaceLanguage, type LanguageSituation, supportedLanguages } from "../interface-language"

const ENGLISH_PHONE = [{ languageTag: "en-GB", languageCode: "en" }]
const GERMAN_PHONE = [{ languageTag: "de-DE", languageCode: "de" }]

function situation(overrides: Partial<LanguageSituation> = {}): LanguageSituation {
	return {
		releaseLanguages: ["cs", "en"],
		releaseDefault: "cs",
		instance: { defaultLanguage: "cs", supportedLanguages: ["cs", "en"] },
		deviceLanguages: ENGLISH_PHONE,
		signedInLanguage: undefined,
		...overrides,
	}
}

describe("interfaceLanguage", () => {
	it("CAP-015-R24 shows the sign-in screen in the phone's language when the instance supports it", () => {
		expect(interfaceLanguage(situation())).toBe("en")
	})

	it("CAP-015-R24 falls back to the instance default for a phone language the instance does not offer", () => {
		expect(interfaceLanguage(situation({ deviceLanguages: GERMAN_PHONE }))).toBe("cs")
		expect(interfaceLanguage(situation({ instance: { defaultLanguage: "cs", supportedLanguages: ["cs"] } }))).toBe("cs")
	})

	it("CAP-015-R24 uses the user's choice after sign-in, and the instance default without one", () => {
		expect(interfaceLanguage(situation({ deviceLanguages: GERMAN_PHONE, signedInLanguage: "en" }))).toBe("en")
		expect(interfaceLanguage(situation({ signedInLanguage: null }))).toBe("cs")
	})

	it("CAP-015-R25 keeps the choice but shows the default while the instance no longer offers it", () => {
		const withdrawn = situation({
			signedInLanguage: "en",
			instance: { defaultLanguage: "cs", supportedLanguages: ["cs"] },
		})
		expect(interfaceLanguage(withdrawn)).toBe("cs")
	})

	it("CAP-015-R24 treats a language without a file in the release as unsupported", () => {
		const listedOnly = situation({
			deviceLanguages: GERMAN_PHONE,
			instance: { defaultLanguage: "de", supportedLanguages: ["cs", "de"] },
		})
		expect(interfaceLanguage(listedOnly)).toBe("cs")
		expect(defaultLanguage(listedOnly)).toBe("cs")
	})

	it("CAP-015-R24 uses the phone's language before the first contact when the release has its file", () => {
		expect(interfaceLanguage(situation({ instance: undefined }))).toBe("en")
		expect(interfaceLanguage(situation({ instance: undefined, deviceLanguages: GERMAN_PHONE }))).toBe("cs")
	})

	it("matches the full tag first and then the plain language code", () => {
		const regional = situation({
			releaseLanguages: ["cs", "en", "en-GB"],
			instance: { defaultLanguage: "cs", supportedLanguages: ["cs", "en", "en-GB"] },
		})
		expect(interfaceLanguage(regional)).toBe("en-GB")
	})
})

describe("supportedLanguages", () => {
	it("CAP-015-S31 offers only languages of the instance list the release has a file for", () => {
		const german = situation({ instance: { defaultLanguage: "cs", supportedLanguages: ["cs", "de", "en"] } })
		expect(supportedLanguages(german)).toEqual(["cs", "en"])
	})

	it("offers every release language before the device ever spoke to the server", () => {
		expect(supportedLanguages(situation({ instance: undefined }))).toEqual(["cs", "en"])
	})
})
