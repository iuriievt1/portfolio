import { type AcquisitionDraft, type AcquisitionDraftUpdate, acquisitionApi } from "../../api/acquisitions"
import { randomUuid } from "../../utils/random-uuid"
import { sessionCaller } from "../session/session-actions"
import { cancelQueuedClosure } from "../upload/closure-queue"
import { captureSessionOf, keepUnlessForgotten, rememberDraft } from "./capture-session"
import { isVersionConflict, retryAfterConflict } from "./conflict-retry"
import { isChangedOnlyInFiles } from "./draft-conflict"
import { requestKeyOf, settleRequestKey } from "./update-request-keys"

// CAP-015-R30, CAP-021-R29, CAP-021-R32, CAP-019-R29
export async function updateDraft(draft: AcquisitionDraft, update: AcquisitionDraftUpdate): Promise<AcquisitionDraft> {
	const requestKey = await requestKeyOf(draft.acquisition_id, JSON.stringify(update), randomUuid)
	const updated = await keepUnlessForgotten(
		() =>
			sessionCaller.call((sessionToken) =>
				acquisitionApi.updateAcquisitionDraft(sessionToken, draft, update, requestKey),
			),
		rememberDraft,
	)
	settleRequestKey(draft.acquisition_id)
	await cancelQueuedClosure(draft.acquisition_id)
	return updated
}

type DraftStep = (draft: AcquisitionDraft) => AcquisitionDraftUpdate | undefined

// CAP-021-R32, CAP-015-R35, E115
export async function saveDraftStep(draft: AcquisitionDraft, step: DraftStep): Promise<void> {
	await retryAfterConflict(
		draft,
		async (current) => {
			const change = step(current)
			if (change === undefined) {
				return
			}
			await updateDraft(current, change)
		},
		{
			isConflict: isVersionConflict,
			refresh: () => refreshDraft(draft.acquisition_id),
			isRetryable: (fresh) => isChangedOnlyInFiles(draft, fresh),
		},
	)
}

// CAP-021-R32, E115
export function refreshDraft(acquisitionId: string): Promise<AcquisitionDraft> {
	return keepUnlessForgotten(
		() => sessionCaller.call((sessionToken) => acquisitionApi.getAcquisitionDraft(sessionToken, acquisitionId)),
		rememberDraft,
	)
}

// CAP-021-R32
export async function knownDraft(acquisitionId: string): Promise<AcquisitionDraft> {
	return captureSessionOf(acquisitionId).draft ?? (await refreshDraft(acquisitionId))
}
