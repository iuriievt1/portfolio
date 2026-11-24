import { useCallback } from "react"
import type { CodeListSet } from "../../../api/code-lists"
import { findingApi, type TimelinePage } from "../../../api/findings"
import { documentationFailureOf } from "../../../api/remote-failure"
import { syncCodeLists } from "../../code-lists/code-list-store"
import { REFRESH, useRemoteContent } from "../../remote/hooks/use-remote-content"
import { sessionCaller } from "../../session/session-actions"
import { type WoundHistory, woundHistoryOf } from "../timeline"
import { useReloadAfterFindingChange } from "./use-reload-after-finding-change"

export interface WoundDetail {
	history: WoundHistory
	codeLists: CodeListSet
}

// CAP-020-R02, CAP-020-R05, CAP-020-R12, CAP-020-R16, E29
export function useWoundHistory(findingId: string) {
	const read = useCallback(async (): Promise<WoundDetail> => {
		const [history, codeLists] = await Promise.all([readWoundHistory(findingId), syncCodeLists()])
		return { history, codeLists }
	}, [findingId])
	const detail = useRemoteContent(read, { failureOf: documentationFailureOf, refresh: REFRESH.ONCE })
	useReloadAfterFindingChange(detail.reload)
	return detail
}

// ADR-012
async function readWoundHistory(findingId: string): Promise<WoundHistory> {
	const pages: TimelinePage[] = []
	let cursor: string | undefined
	do {
		const page = await sessionCaller.call((sessionToken) =>
			findingApi.getFindingHistory(sessionToken, findingId, cursor),
		)
		pages.push(page)
		cursor = page.next_cursor ?? undefined
	} while (cursor !== undefined)
	return woundHistoryOf(pages)
}
