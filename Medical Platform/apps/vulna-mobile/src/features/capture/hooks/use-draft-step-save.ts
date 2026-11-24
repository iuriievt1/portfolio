import { NoSessionError } from "@ansora/core-mobile"
import { useCallback, useRef, useState } from "react"
import type { AcquisitionDraft, AcquisitionDraftUpdate } from "../../../api/acquisitions"
import { type RemoteFailure, remoteFailureOf } from "../../../api/remote-failure"
import { captureSessionOf } from "../capture-session"
import { isVersionConflict } from "../conflict-retry"
import { refreshDraft, saveDraftStep } from "../draft-update"

export const STEP_SAVE_FAILURE = {
	CHANGED: "changed",
	REMOTE: "remote",
} as const

export type StepSaveFailure =
	| { kind: typeof STEP_SAVE_FAILURE.CHANGED }
	| { kind: typeof STEP_SAVE_FAILURE.REMOTE; failure: RemoteFailure }

// CAP-021-R32, E115
function stepSaveFailureOf(error: unknown): StepSaveFailure {
	if (isVersionConflict(error)) {
		return { kind: STEP_SAVE_FAILURE.CHANGED }
	}
	return { kind: STEP_SAVE_FAILURE.REMOTE, failure: remoteFailureOf(error) }
}

interface DraftStepSave {
	isSaving: boolean
	failure: StepSaveFailure | undefined
	save: (update: (draft: AcquisitionDraft) => AcquisitionDraftUpdate | undefined) => Promise<boolean>
	dismiss: () => void
	dismissAnd: (next: () => void) => void
	reload: () => void
}

// CAP-015-R30, CAP-021-R29, CAP-021-R32, CAP-002-R17
export function useDraftStepSave(acquisitionId: string): DraftStepSave {
	const [isSaving, setSaving] = useState(false)
	const [failure, setFailure] = useState<StepSaveFailure | undefined>(undefined)
	const busy = useRef(false)

	const save = useCallback(
		async (update: (draft: AcquisitionDraft) => AcquisitionDraftUpdate | undefined) => {
			const draft = captureSessionOf(acquisitionId).draft
			if (busy.current || draft === undefined) {
				return false
			}
			busy.current = true
			setSaving(true)
			try {
				await saveDraftStep(draft, update)
				return true
			} catch (error) {
				if (!(error instanceof NoSessionError)) {
					setFailure(stepSaveFailureOf(error))
				}
				return false
			} finally {
				busy.current = false
				setSaving(false)
			}
		},
		[acquisitionId],
	)

	const dismiss = useCallback(() => setFailure(undefined), [])

	const dismissAnd = useCallback((next: () => void) => {
		setFailure(undefined)
		next()
	}, [])

	// CAP-021-R32, E115
	const reload = useCallback(() => {
		setFailure(undefined)
		refreshDraft(acquisitionId).catch((error: unknown) => console.warn("the draft could not be read", error))
	}, [acquisitionId])

	return { isSaving, failure, save, dismiss, dismissAnd, reload }
}
