import { useCallback } from "react"
import { callApi } from "@/api/client"
import type {
	CodeList,
	CodeListItem,
	TranslationImport,
	TranslationImportResult,
} from "@/features/code-lists/types/code-list.types"
import { type RequestState, useRequest } from "@/lib/use-request"

const CODE_LISTS_PATH = "/code-lists"
const TRANSLATION_IMPORTS_PATH = `${CODE_LISTS_PATH}/translation-imports`

function itemsPath(codeListCode: string): string {
	return `${CODE_LISTS_PATH}/${encodeURIComponent(codeListCode)}/items`
}

// administration.yaml listCodeLists
export function useCodeLists(): RequestState<CodeList[]> {
	const load = useCallback(() => callApi<CodeList[]>(CODE_LISTS_PATH), [])
	return useRequest(load)
}

// administration.yaml listCodeListItems
export function useCodeListItems(codeListCode: string): RequestState<CodeListItem[]> {
	const load = useCallback(() => callApi<CodeListItem[]>(itemsPath(codeListCode)), [codeListCode])
	return useRequest(load)
}

// administration.yaml setCodeListItems, CAP-017-R18
export function saveCodeListItems(codeListCode: string, items: readonly CodeListItem[]): Promise<CodeListItem[]> {
	return callApi<CodeListItem[]>(itemsPath(codeListCode), { method: "PUT", body: JSON.stringify(items) })
}

// administration.yaml importCodeListTranslations, CAP-017-S09
export function importTranslations(translations: TranslationImport): Promise<TranslationImportResult> {
	return callApi<TranslationImportResult>(TRANSLATION_IMPORTS_PATH, {
		method: "POST",
		body: JSON.stringify(translations),
	})
}
