import * as SecureStore from "expo-secure-store"

const OWNER_LANGUAGE_KEY = "ansora.vulna.owner-language"

interface OwnerLanguage {
	personalNumber: string
	language: string | null
}

// CAP-015-R25
export async function rememberOwnerLanguage(owner: OwnerLanguage): Promise<void> {
	await SecureStore.setItemAsync(OWNER_LANGUAGE_KEY, JSON.stringify(owner))
}

// CAP-007-R04
export async function forgetOwnerLanguage(): Promise<void> {
	await SecureStore.deleteItemAsync(OWNER_LANGUAGE_KEY)
}

export async function ownerLanguageOf(personalNumber: string): Promise<string | null | undefined> {
	const stored = await SecureStore.getItemAsync(OWNER_LANGUAGE_KEY)
	if (stored === null) {
		return undefined
	}
	const owner = JSON.parse(stored) as OwnerLanguage
	return owner.personalNumber === personalNumber ? owner.language : undefined
}
