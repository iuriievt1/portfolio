import type { MobileContract } from "@ansora/contracts"

export type LanguagePreference = MobileContract.components["schemas"]["LanguagePreference"]

export type LanguagePreferenceInput =
	MobileContract.operations["setLanguagePreference"]["requestBody"]["content"]["application/json"]
