export interface InstanceLanguages {
	defaultLanguage: string
	supportedLanguages: readonly string[]
}

interface LanguageRange {
	tag: string
	weight: number
	position: number
}

const RANGE_SEPARATOR = ","
const PARAMETER_SEPARATOR = ";"
const WEIGHT_PARAMETER = /^q=([01](?:\.\d{0,3})?)$/i
const SUBTAG_SEPARATOR = "-"
const WILDCARD = "*"
const FULL_WEIGHT = 1

// CAP-015-R27
export function responseLanguage(acceptLanguage: string | undefined, instance: InstanceLanguages): string {
	for (const range of rangesOf(acceptLanguage)) {
		const supported = supportedLanguageOf(range.tag, instance.supportedLanguages)
		if (supported !== undefined) {
			return supported
		}
	}
	return instance.defaultLanguage
}

// RFC 9110
function rangesOf(acceptLanguage: string | undefined): LanguageRange[] {
	if (acceptLanguage === undefined) {
		return []
	}
	return acceptLanguage
		.split(RANGE_SEPARATOR)
		.map((item, position) => rangeOf(item, position))
		.filter((range): range is LanguageRange => range !== undefined && range.weight > 0 && range.tag !== WILDCARD)
		.sort((first, second) => second.weight - first.weight || first.position - second.position)
}

function rangeOf(item: string, position: number): LanguageRange | undefined {
	const [tag, ...parameters] = item.split(PARAMETER_SEPARATOR).map((part) => part.trim())
	if (tag === undefined || tag === "") {
		return undefined
	}
	const weightParameter = parameters.find((parameter) => WEIGHT_PARAMETER.test(parameter))
	const weight = weightParameter === undefined ? FULL_WEIGHT : Number(WEIGHT_PARAMETER.exec(weightParameter)?.[1])
	return { tag, weight, position }
}

export function supportedLanguageOf(tag: string, supportedLanguages: readonly string[]): string | undefined {
	const wanted = tag.toLowerCase()
	const exact = supportedLanguages.find((language) => language.toLowerCase() === wanted)
	if (exact !== undefined) {
		return exact
	}
	return supportedLanguages.find((language) => primaryOf(language) === primaryOf(wanted))
}

function primaryOf(tag: string): string {
	return tag.toLowerCase().split(SUBTAG_SEPARATOR)[0] ?? tag.toLowerCase()
}
