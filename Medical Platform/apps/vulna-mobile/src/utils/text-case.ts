const TEXT_CASE = {
	LOWER: "lower",
	ORIGINAL: "original",
} as const

// CAP-015-R23, CAP-017-R18
export function inTextCase(text: string, textCase: string, language: string): string {
	return textCase === TEXT_CASE.LOWER ? text.toLocaleLowerCase(language) : text
}
