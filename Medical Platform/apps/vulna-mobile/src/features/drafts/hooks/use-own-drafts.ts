import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import { useRemoteContent } from "../../remote/hooks/use-remote-content"
import { sessionCaller } from "../../session/session-actions"
import { useReloadAfterClosure } from "../../upload/hooks/use-reload-after-closure"
import { readOwnDrafts } from "../own-drafts"

export interface OwnDrafts {
	drafts: readonly AcquisitionDraftSummary[]
}

async function readOwnDraftsContent(): Promise<OwnDrafts> {
	return { drafts: await sessionCaller.call(readOwnDrafts) }
}

// CAP-015-R29, CAP-015-R30, CAP-019-R28
export function useOwnDrafts() {
	const content = useRemoteContent(readOwnDraftsContent)
	useReloadAfterClosure(content.reload)
	return content
}
