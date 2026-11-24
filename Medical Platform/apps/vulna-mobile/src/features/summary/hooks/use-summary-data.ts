import { useCallback } from "react"
import { type AcquisitionDraft, acquisitionApi } from "../../../api/acquisitions"
import type { CodeListSet } from "../../../api/code-lists"
import { syncCodeLists } from "../../code-lists/code-list-store"
import { useRemoteContent } from "../../remote/hooks/use-remote-content"
import { sessionCaller } from "../../session/session-actions"

export interface SummaryData {
	codeLists: CodeListSet
	draft: AcquisitionDraft
}

// CAP-014-R14, CAP-015-R15
export function useSummaryData(acquisitionId: string) {
	const read = useCallback(async (): Promise<SummaryData> => {
		const [codeLists, draft] = await Promise.all([
			syncCodeLists(),
			sessionCaller.call((sessionToken) => acquisitionApi.getAcquisitionDraft(sessionToken, acquisitionId)),
		])
		return { codeLists, draft }
	}, [acquisitionId])
	return useRemoteContent(read)
}
