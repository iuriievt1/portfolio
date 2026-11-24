import { isSameLanguage, nameIn } from "@ansora/contracts"
import {
	type CodeListItemState,
	FIRST_CODE_LIST_ITEM_SEQUENCE,
	itemStatesEqual,
	withoutLanguage,
} from "./code-list-item"

// administration.yaml setCodeListItems
export interface RequestedCodeListItem {
	code: string
	name: string
	names: Readonly<Record<string, string | null>> | undefined
	sequence: number | undefined
	isActive: boolean | undefined
}

export type CodeListItemsChange =
	| { ok: true; items: CodeListItemState[]; changed: CodeListItemState[]; changedNames: number }
	| { ok: false; codesWithoutName: string[] }

// CAP-017-R08, CAP-017-R18, CAP-017-S08, administration.yaml setCodeListItems
export function changeCodeListItems(
	existing: readonly CodeListItemState[],
	requested: readonly RequestedCodeListItem[],
	defaultLanguage: string,
): CodeListItemsChange {
	const codesWithoutName = requested.filter((item) => !hasDefaultName(item, defaultLanguage)).map((item) => item.code)
	if (codesWithoutName.length > 0) {
		return { ok: false, codesWithoutName }
	}
	const existingByCode = new Map(existing.map((item) => [item.code, item]))
	const requestedCodes = new Set(requested.map((item) => item.code))
	const kept = requested.map((item, position) =>
		requestedState(item, position, existingByCode.get(item.code), defaultLanguage),
	)
	// CAP-017-R08
	const withdrawn = existing
		.filter((item) => !requestedCodes.has(item.code))
		.map((item) => ({ ...item, isActive: false }))
	const items = [...kept, ...withdrawn]
	const changed = items.filter((item) => {
		const before = existingByCode.get(item.code)
		return before === undefined || !itemStatesEqual(before, item)
	})
	const changedNames = changed.reduce(
		(count, item) => count + changedNameCount(existingByCode.get(item.code)?.names ?? {}, item.names),
		0,
	)
	return { ok: true, items, changed, changedNames }
}

function hasDefaultName(item: RequestedCodeListItem, defaultLanguage: string): boolean {
	const name = item.name.trim()
	if (name === "") {
		return false
	}
	const entry = Object.entries(item.names ?? {}).find(([language]) => isSameLanguage(language, defaultLanguage))
	return entry === undefined || entry[1] === name
}

function requestedState(
	item: RequestedCodeListItem,
	position: number,
	before: CodeListItemState | undefined,
	defaultLanguage: string,
): CodeListItemState {
	let names: Record<string, string> = { ...(before?.names ?? {}) }
	for (const [language, name] of Object.entries(item.names ?? {})) {
		names = withoutLanguage(names, language)
		if (name !== null) {
			names[language] = name.trim()
		}
	}
	names = withoutLanguage(names, defaultLanguage)
	names[defaultLanguage] = item.name.trim()
	return {
		code: item.code,
		sequence: item.sequence ?? position + FIRST_CODE_LIST_ITEM_SEQUENCE,
		isActive: item.isActive ?? true,
		names,
	}
}

function changedNameCount(before: Readonly<Record<string, string>>, after: Readonly<Record<string, string>>): number {
	const languages = new Set([...Object.keys(before), ...Object.keys(after)].map((language) => language.toLowerCase()))
	return [...languages].filter((language) => nameIn(before, language) !== nameIn(after, language)).length
}
