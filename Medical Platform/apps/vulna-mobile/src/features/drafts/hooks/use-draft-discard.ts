import type { DiscardSituation } from "@ansora/contracts"
import { NoSessionError } from "@ansora/core-mobile"
import { useCallback, useState } from "react"
import { type AcquisitionDraft, type AcquisitionDraftSummary, acquisitionApi } from "../../../api/acquisitions"
import { sessionCaller } from "../../session/session-actions"
import { DRAFT_DISCARD, type DraftDiscard, discardStateOfError } from "../draft-discard"

const IDLE: DraftDiscard = { kind: DRAFT_DISCARD.IDLE }

// CAP-015-R17, CAP-015-R18, CAP-015-S14, CAP-015-S44, CAP-021-R32
export function useDraftDiscard(situation: DiscardSituation, onListChanged: () => void) {
	const [discard, setDiscard] = useState<DraftDiscard>(IDLE)

	const fail = useCallback((error: unknown) => {
		setDiscard(error instanceof NoSessionError ? IDLE : discardStateOfError(error))
	}, [])

	const choose = useCallback(
		async (summary: AcquisitionDraftSummary) => {
			setDiscard({ kind: DRAFT_DISCARD.PREPARING })
			try {
				const draft = await sessionCaller.call((sessionToken) =>
					acquisitionApi.getAcquisitionDraft(sessionToken, summary.acquisition_id),
				)
				setDiscard({ kind: DRAFT_DISCARD.CONFIRMING, draft })
			} catch (error) {
				fail(error)
			}
		},
		[fail],
	)

	const confirm = useCallback(
		async (draft: AcquisitionDraft) => {
			setDiscard({ kind: DRAFT_DISCARD.DISCARDING, draft })
			try {
				await sessionCaller.call((sessionToken) =>
					acquisitionApi.discardAcquisitionDraft(sessionToken, draft, { situation }),
				)
				setDiscard(IDLE)
				onListChanged()
			} catch (error) {
				fail(error)
			}
		},
		[situation, onListChanged, fail],
	)

	const dismiss = useCallback(() => {
		if (discard.kind === DRAFT_DISCARD.CHANGED) {
			onListChanged()
		}
		setDiscard(IDLE)
	}, [discard.kind, onListChanged])

	return { discard, choose, confirm, dismiss }
}
