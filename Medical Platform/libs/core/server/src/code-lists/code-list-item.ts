import { isSameLanguage, nameIn } from "@ansora/contracts"

// CAP-017-R08, CAP-017-R18, ADR-023
export interface CodeListItemState {
	code: string
	sequence: number
	isActive: boolean
	names: Readonly<Record<string, string>>
}

export const FIRST_CODE_LIST_ITEM_SEQUENCE = 1

export function withoutLanguage(names: Readonly<Record<string, string>>, language: string): Record<string, string> {
	return Object.fromEntries(Object.entries(names).filter(([key]) => !isSameLanguage(key, language)))
}

function namesEqual(left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>): boolean {
	const leftKeys = Object.keys(left)
	if (leftKeys.length !== Object.keys(right).length) {
		return false
	}
	return leftKeys.every((key) => right[key] === left[key])
}

export function itemStatesEqual(left: CodeListItemState, right: CodeListItemState): boolean {
	return (
		left.code === right.code &&
		left.sequence === right.sequence &&
		left.isActive === right.isActive &&
		namesEqual(left.names, right.names)
	)
}

// CAP-012-R28, CAP-012-S19
export function itemsWithoutName<Item extends CodeListItemState>(items: readonly Item[], language: string): Item[] {
	return items.filter((item) => item.isActive && nameIn(item.names, language) === undefined)
}
