import { useCallback } from "react"
import type { CodeListSet } from "../../../api/code-lists"
import type { LoadedPage } from "../../../api/pages"
import { usePagedContent } from "../../remote/hooks/use-paged-content"
import { syncCodeLists } from "../code-list-store"

export interface WithCodeLists {
	codeLists: CodeListSet
}

// CAP-020-R12, ADR-012
export function usePagedWithCodeLists<Item>(readPage: (cursor: string | undefined) => Promise<LoadedPage<Item>>) {
	const readFirst = useCallback(async () => {
		const [page, codeLists] = await Promise.all([readPage(undefined), syncCodeLists()])
		return { ...page, codeLists }
	}, [readPage])
	return usePagedContent<Item, WithCodeLists>(readFirst, readPage)
}
