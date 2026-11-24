import { CONFIGURATION_KEY } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { ProfileService } from "../../../libs/profile/profile.service"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { LocalizationService } from "../localization.service"

const PROFILE = {
	configurationSchema: { properties: { localization: { properties: { default_language: { default: "cs" } } } } },
} as unknown as ProfileService

function serviceWith(entries: readonly (readonly [string, unknown])[] | undefined): LocalizationService {
	const configuration = {
		values: async () => {
			if (entries === undefined) {
				throw new Error("the database is unavailable")
			}
			return new Map(entries)
		},
	} as unknown as ConfigurationService
	return new LocalizationService(configuration, PROFILE)
}

const INSTANCE = [
	[CONFIGURATION_KEY.DEFAULT_LANGUAGE, "cs"],
	[CONFIGURATION_KEY.SUPPORTED_LANGUAGES, ["cs", "en"]],
] as const

describe("LocalizationService", () => {
	it("CAP-015-S32 a supported language answers in it", async () => {
		const answer = await serviceWith(INSTANCE).responseTexts("en")
		expect(answer.contentLanguage).toBe("en")
		expect(answer.texts.problems["login-failed"]).toBe("Sign-in failed")
	})

	it("CAP-015-S33 an unsupported language answers in the default", async () => {
		const answer = await serviceWith(INSTANCE).responseTexts("de")
		expect(answer.contentLanguage).toBe("cs")
		expect(answer.texts.problems["login-failed"]).toBe("Přihlášení se nepovedlo")
	})

	it("CAP-015-R27 a language outside the instance list answers in the default", async () => {
		const answer = await serviceWith([
			[CONFIGURATION_KEY.DEFAULT_LANGUAGE, "cs"],
			[CONFIGURATION_KEY.SUPPORTED_LANGUAGES, ["cs"]],
		]).responseTexts("en")
		expect(answer.contentLanguage).toBe("cs")
	})

	it("CAP-015-R26 a language without server texts answers in the default", async () => {
		const answer = await serviceWith([
			[CONFIGURATION_KEY.DEFAULT_LANGUAGE, "cs"],
			[CONFIGURATION_KEY.SUPPORTED_LANGUAGES, ["cs", "de"]],
		]).responseTexts("de")
		expect(answer.contentLanguage).toBe("cs")
	})

	it("CAP-015-R27 unreadable configuration answers in the release default", async () => {
		const answer = await serviceWith(undefined).responseTexts("en")
		expect(answer.contentLanguage).toBe("cs")
	})

	it("CAP-004-R13 administration answers in Czech", () => {
		expect(serviceWith(INSTANCE).administrationTexts().contentLanguage).toBe("cs")
	})

	it("CAP-012-R28 names a supported language in the form of the instance list, regardless of case", async () => {
		const service = serviceWith([
			[CONFIGURATION_KEY.DEFAULT_LANGUAGE, "cs"],
			[CONFIGURATION_KEY.SUPPORTED_LANGUAGES, ["cs", "EN"]],
		])

		expect(await service.supportedLanguage("en")).toBe("EN")
		expect(await service.supportedLanguage("CS")).toBe("cs")
		expect(await service.supportedLanguage("de")).toBeUndefined()
	})

	it("CAP-017-S07 names data in the requested language and keeps the instance default as fallback", async () => {
		expect(await serviceWith(INSTANCE).nameLanguages("en")).toEqual({ response: "en", instanceDefault: "cs" })
		expect(await serviceWith(INSTANCE).nameLanguages("de")).toEqual({ response: "cs", instanceDefault: "cs" })
	})
})
