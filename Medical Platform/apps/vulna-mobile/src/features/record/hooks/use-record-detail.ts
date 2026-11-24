import { useCallback, useEffect } from "react"
import { recordApi } from "../../../api/record"
import { documentationFailureOf } from "../../../api/remote-failure"
import { syncCodeLists } from "../../code-lists/code-list-store"
import { LOAD_STATE, REFRESH, useRemoteContent } from "../../remote/hooks/use-remote-content"
import { sessionCaller } from "../../session/session-actions"
import { heldRecordOf, holdRecord, type RecordContent } from "../held-records"

export type { RecordContent } from "../held-records"

// CAP-020-R17, CAP-020-R02, CAP-025-R28, E29
export function useRecordDetail(acquisitionId: string) {
	const read = useCallback(async (): Promise<RecordContent> => {
		const held = heldRecordOf(acquisitionId)
		if (held !== undefined) {
			return held
		}
		const [detail, codeLists] = await Promise.all([
			sessionCaller.call((sessionToken) => recordApi.getAcquisition(sessionToken, acquisitionId)),
			syncCodeLists(),
		])
		return { detail, codeLists }
	}, [acquisitionId])
	const record = useRemoteContent(read, { failureOf: documentationFailureOf, refresh: REFRESH.ONCE })
	const { state } = record

	useEffect(() => {
		if (state.kind !== LOAD_STATE.READY) {
			return
		}
		return holdRecord(acquisitionId, { detail: state.detail, codeLists: state.codeLists })
	}, [acquisitionId, state])

	return record
}
