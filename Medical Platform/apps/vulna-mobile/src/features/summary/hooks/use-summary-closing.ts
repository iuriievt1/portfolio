import type { AcquisitionKind } from "@ansora/contracts"
import { shownFilesOf } from "@ansora/core-mobile"
import { useEffect, useMemo } from "react"
import { clinicalSteps } from "../../assessment/instance-clinical-steps"
import { type CaptureSession, rememberDraft, useCaptureSession, WOUND_CHOICE } from "../../capture/capture-session"
import { useHoldScreen } from "../../capture/hooks/use-hold-screen"
import { LOAD_STATE, type LoadState } from "../../remote/hooks/use-remote-content"
import { reconcileFiles } from "../../upload/upload-queue"
import { missingStepsOf } from "../closing"
import type { RecordFile } from "../shown-file"
import { latestDraftOf } from "../summary-view"
import { CLOSING, type ClosingState, useRecordClosing } from "./use-record-closing"
import { type SummaryData, useSummaryData } from "./use-summary-data"

export interface SummaryClosing {
	isClosing: boolean
	onConfirm: (() => void) | undefined
}

interface ClosingDialogsWiring {
	kind: AcquisitionKind
	state: ClosingState
	onRetry: () => void
	onDismiss: () => void
	onReload: () => void
	onQueuedSeen: () => void
}

interface SummaryClosingWiring {
	session: CaptureSession
	data: LoadState<SummaryData>
	files: readonly RecordFile[]
	retry: () => void
	closing: SummaryClosing
	dialogs: ClosingDialogsWiring
}

interface Source {
	kind: AcquisitionKind
	acquisitionId: string
	onClosed: () => void
}

// CAP-014-R14, CAP-015-R31, CAP-018-R14, CAP-015-R35, CAP-015-R36, CAP-019-R29, CAP-009-S05, E93, E107, E115, Q-076
export function useSummaryClosing({ kind, acquisitionId, onClosed }: Source): SummaryClosingWiring {
	const session = useCaptureSession(acquisitionId)
	const { state: data, retry } = useSummaryData(acquisitionId)
	const loaded = data.kind === LOAD_STATE.READY ? data.draft : undefined
	const shown = loaded === undefined ? session.draft : latestDraftOf(session.draft, loaded)
	const isNewWound = session.wound?.kind === WOUND_CHOICE.NEW
	const serverFiles = shown?.files
	const files = useMemo(() => shownFilesOf(session.photos, serverFiles ?? []), [session.photos, serverFiles])
	const closing = useRecordClosing({ acquisitionId, kind, shown, shownFiles: files, isNewWound, onClosed })
	useHoldScreen(closing.state.kind === CLOSING.CLOSING)

	// CAP-015-R35, CAP-015-R36
	useEffect(() => {
		if (loaded === undefined) {
			return
		}
		rememberDraft(loaded)
		reconcileFiles(acquisitionId, loaded.files).catch((failure: unknown) =>
			console.warn("the files of the record could not be reconciled", failure),
		)
	}, [acquisitionId, loaded])

	const isComplete =
		shown !== undefined &&
		missingStepsOf({ draft: shown, fileCount: files.length, isNewWound, steps: clinicalSteps() }).length === 0
	const isClosing = closing.state.kind === CLOSING.CLOSING || closing.state.kind === CLOSING.CLOSED

	// E115
	const reload = () => {
		closing.dismiss()
		retry()
	}

	return {
		session,
		data,
		files,
		retry,
		closing: {
			isClosing,
			onConfirm: isComplete ? closing.confirm : undefined,
		},
		dialogs: {
			kind,
			state: closing.state,
			onRetry: closing.confirm,
			onDismiss: closing.dismiss,
			onReload: reload,
			onQueuedSeen: onClosed,
		},
	}
}
