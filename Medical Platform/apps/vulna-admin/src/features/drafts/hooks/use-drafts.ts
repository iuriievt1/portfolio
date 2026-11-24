import { useCallback } from "react"
import { callApi, withQuery } from "@/api/client"
import type {
	AdministeredDraft,
	AdministeredDraftsPage,
	DraftDiscardRequest,
	DraftDiscardResult,
	DraftQuery,
} from "@/features/drafts/types/draft.types"
import { type CursorList, useCursorList } from "@/lib/use-cursor-list"

const DRAFTS_PATH = "/acquisition-drafts"
const DISCARD_PATH = `${DRAFTS_PATH}/discard`

// CAP-004-R14
export function useDrafts(query: DraftQuery): CursorList<AdministeredDraft> {
	const { operatorUserId, notUpdatedSince } = query
	const loadPage = useCallback(
		(cursor: string | undefined) =>
			callApi<AdministeredDraftsPage>(
				withQuery(DRAFTS_PATH, { cursor, operator_user_id: operatorUserId, not_updated_since: notUpdatedSince }),
			),
		[operatorUserId, notUpdatedSince],
	)
	return useCursorList(loadPage)
}

// CAP-015-R19, CAP-015-R20
export function discardDraftsWithConsent(request: DraftDiscardRequest): Promise<DraftDiscardResult> {
	return callApi<DraftDiscardResult>(DISCARD_PATH, { method: "POST", body: JSON.stringify(request) })
}
