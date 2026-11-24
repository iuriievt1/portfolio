import { useCallback } from "react"
import type { CodeListItems } from "../../assessment/hooks/use-code-list-items"
import { syncCodeLists } from "../../code-lists/code-list-store"
import { useRemoteContent } from "../../remote/hooks/use-remote-content"

// CAP-018-R15, CAP-017-R08, CAP-017-R18
export function useDocumentTitles() {
	const read = useCallback(async (): Promise<CodeListItems> => {
		const codeLists = await syncCodeLists()
		return { items: codeLists.document_titles.filter((item) => item.is_selectable), version: codeLists.version }
	}, [])
	return useRemoteContent(read)
}
