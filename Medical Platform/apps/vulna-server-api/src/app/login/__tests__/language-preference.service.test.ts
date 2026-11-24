import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { LocalizationService } from "../../localization/localization.service"
import type { AppUserRepository } from "../repositories/app-user.repository"
import { LanguagePreferenceService } from "../services/language-preference.service"
import type { AppUser } from "../types/login.types"

const USER_ID = "22222222-2222-4222-8222-222222222222"
const INSTANCE_LANGUAGES = ["cs", "en"]

interface Harness {
	service: LanguagePreferenceService
	saved: string[]
}

function harnessWith(preferredLanguage: string | null, supported: readonly string[] = INSTANCE_LANGUAGES): Harness {
	const saved: string[] = []
	let stored = preferredLanguage
	const users = {
		findById: async (id: string): Promise<AppUser | undefined> =>
			id === USER_ID
				? {
						id,
						personalNumber: "004211",
						loginName: null,
						email: null,
						displayName: "Jana Nováková",
						isActive: true,
						preferredLanguage: stored,
					}
				: undefined,
		setPreferredLanguage: async (_userId: string, language: string) => {
			saved.push(language)
			stored = language
		},
	} as unknown as AppUserRepository
	const localization = {
		supportedLanguage: async (code: string) =>
			supported.find((language) => language.toLowerCase() === code.toLowerCase()),
	} as unknown as LocalizationService
	return { service: new LanguagePreferenceService(users, localization), saved }
}

describe("LanguagePreferenceService", () => {
	it("reads no choice for a user who never chose a language", async () => {
		expect(await harnessWith(null).service.preferenceOf(USER_ID)).toEqual({ language: null })
	})

	it("CAP-015-S26 keeps the choice with the user on the server, so another device reads it", async () => {
		const { service, saved } = harnessWith(null)

		expect(await service.choose(USER_ID, "en")).toEqual({ language: "en" })
		expect(saved).toEqual(["en"])
		expect(await service.preferenceOf(USER_ID)).toEqual({ language: "en" })
	})

	it("stores the code in the form of the instance list", async () => {
		const { service, saved } = harnessWith(null)

		expect(await service.choose(USER_ID, "EN")).toEqual({ language: "en" })
		expect(saved).toEqual(["en"])
	})

	it("CAP-015-R25 refuses a language the instance does not support and keeps the previous choice", async () => {
		const { service, saved } = harnessWith("cs")

		const refusal = await service.choose(USER_ID, "de").catch((error: unknown) => error)

		expect(refusal).toBeInstanceOf(ProblemException)
		expect((refusal as ProblemException).getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect((refusal as ProblemException).code).toBe(ERROR_CODE.LANGUAGE_UNSUPPORTED)
		expect(saved).toEqual([])
		expect(await service.preferenceOf(USER_ID)).toEqual({ language: "cs" })
	})

	it("CAP-015-S34 keeps a choice the administrator took off the supported list", async () => {
		const { service } = harnessWith("en", ["cs"])

		expect(await service.preferenceOf(USER_ID)).toEqual({ language: "en" })
	})

	it("changes nothing when the same language is chosen again", async () => {
		const { service, saved } = harnessWith("en")

		expect(await service.choose(USER_ID, "en")).toEqual({ language: "en" })
		expect(saved).toEqual([])
	})
})
