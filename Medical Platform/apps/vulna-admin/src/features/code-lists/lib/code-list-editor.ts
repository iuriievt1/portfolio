import { CONFIGURATION_KEY, isSameLanguage, type LocalizedNames, nameIn } from "@ansora/contracts"
import type { EditableItem } from "@/features/code-lists/lib/code-list-items.schema"
import type { CodeListItem } from "@/features/code-lists/types/code-list.types"
import type { Configuration } from "@/features/configuration/types/configuration.types"

export function defaultLanguageOf(configuration: Configuration): string | undefined {
	const value = configuration.items.find((item) => item.key === CONFIGURATION_KEY.DEFAULT_LANGUAGE)?.value
	return typeof value === "string" ? value : undefined
}

// CAP-017-R18
export function editedLanguagesOf(defaultLanguage: string, editable: readonly string[]): string[] {
	const languages = [defaultLanguage]
	for (const language of editable) {
		if (!languages.some((known) => isSameLanguage(known, language))) {
			languages.push(language)
		}
	}
	return languages
}

function textNamesOf(item: CodeListItem): Record<string, string> {
	return Object.fromEntries(
		Object.entries(item.names ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
	)
}

function shownNamesOf(stored: LocalizedNames, languages: readonly string[]): Record<string, string> {
	return Object.fromEntries(languages.map((language) => [language, nameIn(stored, language) ?? ""]))
}

export function editableItemsOf(items: readonly CodeListItem[], languages: readonly string[]): EditableItem[] {
	return [...items]
		.sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0))
		.map((item) => {
			const storedNames = textNamesOf(item)
			return {
				code: item.code,
				isNew: false,
				isActive: item.is_active ?? true,
				names: shownNamesOf(storedNames, languages),
				storedNames,
			}
		})
}

export function newItem(languages: readonly string[]): EditableItem {
	return { code: "", isNew: true, isActive: true, names: shownNamesOf({}, languages), storedNames: {} }
}

// administration.yaml setCodeListItems, CAP-017-R18
export function requestOf(
	items: readonly EditableItem[],
	defaultLanguage: string,
	languages: readonly string[],
): CodeListItem[] {
	return items.map((item, index) => {
		const names: Record<string, string | null> = {}
		for (const language of languages) {
			if (isSameLanguage(language, defaultLanguage)) {
				continue
			}
			const edited = (nameIn(item.names, language) ?? "").trim()
			if (edited !== "") {
				names[language] = edited
			} else if ((nameIn(item.storedNames, language) ?? "") !== "") {
				names[language] = null
			}
		}
		return {
			code: item.code.trim(),
			name: (nameIn(item.names, defaultLanguage) ?? "").trim(),
			names,
			sequence: index + 1,
			is_active: item.isActive,
		}
	})
}

export function otherLanguagesOf(item: EditableItem, languages: readonly string[]): string[] {
	return Object.keys(item.storedNames).filter((language) => !languages.some((shown) => isSameLanguage(shown, language)))
}
