import cs from "./cs.json"
import en from "./en.json"

export type Texts = typeof cs

export type PartialTexts<T> = { [K in keyof T]?: T[K] extends object ? PartialTexts<T[K]> : T[K] }

export const RELEASE_TEXTS: Readonly<Record<string, PartialTexts<Texts>>> = {
	[cs.language]: cs,
	[en.language]: en,
}

const PLURAL_OTHER = "other"

export const RELEASE_LANGUAGES: readonly string[] = Object.keys(RELEASE_TEXTS)

export function languageNameOf(language: string): string {
	return RELEASE_TEXTS[language]?.languageName ?? language
}

// CAP-015-R23, CAP-015-R26
export function layeredTexts(complete: string, layers: readonly string[]): Texts {
	return layers.reduce<Texts>(
		(merged, language) => overlayTexts(merged, RELEASE_TEXTS[language] ?? {}),
		RELEASE_TEXTS[complete] as Texts,
	)
}

export function overlayTexts<T>(base: T, layer: PartialTexts<T>): T {
	const merged = { ...base }
	for (const key of Object.keys(layer) as (keyof T)[]) {
		const value = layer[key]
		if (value === undefined) {
			continue
		}
		merged[key] = isGroup(value) ? overlayTexts(base[key], value as PartialTexts<T[keyof T]>) : (value as T[keyof T])
	}
	return merged
}

function isGroup(value: unknown): boolean {
	return typeof value === "object" && value !== null && !(PLURAL_OTHER in value)
}
