export interface DeviceLanguage {
	languageTag: string
	languageCode: string | null
}

export interface InstanceLanguages {
	defaultLanguage: string | undefined
	supportedLanguages: readonly string[] | undefined
}

export interface LanguageSituation {
	releaseLanguages: readonly string[]
	releaseDefault: string
	instance: InstanceLanguages | undefined
	deviceLanguages: readonly DeviceLanguage[]
	signedInLanguage: string | null | undefined
}

// CAP-015-R24
export function interfaceLanguage(situation: LanguageSituation): string {
	const supported = supportedLanguages(situation)
	const fallback = defaultLanguage(situation)
	if (situation.signedInLanguage !== undefined) {
		const chosen = situation.signedInLanguage
		return chosen !== null && supported.includes(chosen) ? chosen : fallback
	}
	return deviceLanguageAmong(situation.deviceLanguages, supported) ?? fallback
}

// CAP-015-R26
export function defaultLanguage(situation: LanguageSituation): string {
	const instanceDefault = situation.instance?.defaultLanguage
	return instanceDefault !== undefined && situation.releaseLanguages.includes(instanceDefault)
		? instanceDefault
		: situation.releaseDefault
}

// CAP-015-R24
export function supportedLanguages(situation: LanguageSituation): readonly string[] {
	const listed = situation.instance?.supportedLanguages
	return listed === undefined
		? situation.releaseLanguages
		: listed.filter((language) => situation.releaseLanguages.includes(language))
}

function deviceLanguageAmong(device: readonly DeviceLanguage[], supported: readonly string[]): string | undefined {
	for (const language of device) {
		if (supported.includes(language.languageTag)) {
			return language.languageTag
		}
		if (language.languageCode !== null && supported.includes(language.languageCode)) {
			return language.languageCode
		}
	}
	return undefined
}
