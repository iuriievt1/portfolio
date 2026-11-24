import { useCallback } from "react"
import type { CodeListItem, CodeListSet } from "../../../api/code-lists"
import { syncCodeLists } from "../../code-lists/code-list-store"
import { useRemoteContent } from "../../remote/hooks/use-remote-content"

export interface CodeListItems {
	items: readonly CodeListItem[]
	version: string
}

// CAP-017-R09, CAP-020-R21
export interface CodeListChoices extends CodeListItems {
	all: readonly CodeListItem[]
}

type ItemsOf = (codeLists: CodeListSet) => readonly CodeListItem[]

const woundTypesOf: ItemsOf = (codeLists) => codeLists.wound_types
const healingPhasesOf: ItemsOf = (codeLists) => codeLists.healing_phases

// CAP-017-R02
export function useWoundTypes() {
	return useSelectableItems(woundTypesOf)
}

// CAP-017-R03
export function useHealingPhases() {
	return useSelectableItems(healingPhasesOf)
}

// CAP-017-R08, CAP-017-R09, CAP-017-R18
function useSelectableItems(itemsOf: ItemsOf) {
	const read = useCallback(async (): Promise<CodeListChoices> => {
		const codeLists = await syncCodeLists()
		const all = itemsOf(codeLists)
		return { items: all.filter((item) => item.is_selectable), all, version: codeLists.version }
	}, [itemsOf])
	return useRemoteContent(read)
}
