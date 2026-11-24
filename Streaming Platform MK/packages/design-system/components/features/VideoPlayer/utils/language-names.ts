// Well-known codes, so a runtime with trimmed ICU data still resolves the ones our streams
// actually carry. Covers ISO 639-1 plus both 639-2 spellings broadcasters use (`fra`/`fre`).
const KNOWN_LANGUAGE_NAMES: Record<string, string> = {
	en: 'English',
	eng: 'English',
	es: 'Spanish',
	spa: 'Spanish',
	fr: 'French',
	fra: 'French',
	fre: 'French',
	de: 'German',
	deu: 'German',
	ger: 'German',
	it: 'Italian',
	ita: 'Italian',
	pt: 'Portuguese',
	por: 'Portuguese',
	nl: 'Dutch',
	nld: 'Dutch',
	dut: 'Dutch',
	cs: 'Czech',
	ces: 'Czech',
	cze: 'Czech',
	sk: 'Slovak',
	slk: 'Slovak',
	slo: 'Slovak',
	pl: 'Polish',
	pol: 'Polish',
	sv: 'Swedish',
	swe: 'Swedish',
	da: 'Danish',
	dan: 'Danish',
	no: 'Norwegian',
	nor: 'Norwegian',
	fi: 'Finnish',
	fin: 'Finnish',
	ru: 'Russian',
	rus: 'Russian',
	uk: 'Ukrainian',
	ukr: 'Ukrainian',
	ar: 'Arabic',
	ara: 'Arabic',
	hi: 'Hindi',
	hin: 'Hindi',
	ja: 'Japanese',
	jpn: 'Japanese',
	ko: 'Korean',
	kor: 'Korean',
	zh: 'Chinese',
	zho: 'Chinese',
	chi: 'Chinese',
	tr: 'Turkish',
	tur: 'Turkish',
	el: 'Greek',
	ell: 'Greek',
	gre: 'Greek',
	he: 'Hebrew',
	heb: 'Hebrew',
	hu: 'Hungarian',
	hun: 'Hungarian',
	ro: 'Romanian',
	ron: 'Romanian',
	rum: 'Romanian',
}

// A bare language tag (`en`, `eng`, `FRA`, `pt-BR`) — not a human label like `English (Commentary)`
// and not a multiview feed id like `eng_A`, both of which must survive untouched.
const LANGUAGE_TAG_PATTERN = /^[a-z]{2,3}(?:[-_][a-z]{2,4})?$/i

/** True when the value is a language code rather than a display label. */
export function isLanguageTag(value: string): boolean {
	return LANGUAGE_TAG_PATTERN.test(value.trim())
}

/** Resolve a language code to a display name. Returns undefined when the code is missing,
 *  undetermined, or unknown — callers then show the raw tag rather than inventing a name. */
export function formatLanguageName(lang?: string): string | undefined {
	const normalized = lang?.trim().replace(/_/g, '-')
	if (!normalized || normalized.toLowerCase() === 'und') return undefined

	try {
		const displayName = new Intl.DisplayNames(['en'], { type: 'language' }).of(normalized)
		// DisplayNames echoes the input back when it cannot resolve it — that is not a name.
		if (displayName && displayName.toLowerCase() !== normalized.toLowerCase()) return displayName
	} catch (err) {
		console.warn(`[TRACKS] Intl.DisplayNames failed for "${normalized}" — using the known-codes table`, err)
	}

	const primaryLanguage = normalized.split('-')[0]?.toLowerCase()
	return primaryLanguage ? KNOWN_LANGUAGE_NAMES[primaryLanguage] : undefined
}
