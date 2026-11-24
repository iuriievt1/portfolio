import type { MobileContract } from "@ansora/contracts"
import { callApi } from "./client"

export type LanguagePreference = MobileContract.components["schemas"]["LanguagePreference"]

const LANGUAGE_PREFERENCE_PATH: keyof MobileContract.paths = "/user/language-preference"

export const languageApi = {
	setLanguagePreference: (sessionToken: string, language: string): Promise<LanguagePreference> =>
		callApi<LanguagePreference>(LANGUAGE_PREFERENCE_PATH, { method: "PUT", sessionToken, body: { language } }),
}
