import { ACQUISITION_STATE_VALUE, type AcquisitionKind } from "@ansora/contracts"
import { NoSessionError, type ShownFile } from "@ansora/core-mobile"
import { useCallback, useEffect, useRef, useState } from "react"
import { type AcquisitionDraft, acquisitionApi } from "../../../api/acquisitions"
import { clinicalSteps } from "../../assessment/instance-clinical-steps"
import { useCaptureSession } from "../../capture/capture-session"
import { refreshDraft } from "../../capture/draft-update"
import { sessionCaller } from "../../session/session-actions"
import { currentSession } from "../../session/session-store"
import { queueClosure } from "../../upload/closure-queue"
import { hasUploadsInFlight, pumpUploads, reconcileFiles, retryUploadsNow } from "../../upload/upload-queue"
import { awaitedFilesOf } from "../../upload/waiting-files"
import {
	CLOSING,
	CLOSING_STATE,
	CLOSURE_CHECK,
	type ClosingState,
	type ClosureCheck,
	closingFailureOf,
	closureCheckOf,
	closureOf,
	MISSING_UNNAMED,
	missingStepsOf,
	NoResponseError,
	TO_QUEUE,
	withinResponseTime,
} from "../closing"
import { contentFingerprintOf } from "../confirmed-content"

export { CLOSING, type ClosingState } from "../closing"

type SettleStep = ClosingState | typeof TO_QUEUE

interface RecordClosing {
	state: ClosingState
	confirm: () => void
	dismiss: () => void
}

interface Source {
	acquisitionId: string
	kind: AcquisitionKind
	shown: AcquisitionDraft | undefined
	shownFiles: readonly Pick<ShownFile, "fileKey">[]
	isNewWound: boolean
	onClosed: () => void
}

// CAP-021-R25, CAP-021-R32, CAP-019-R29
interface Confirmation {
	draft: AcquisitionDraft
	fileKeys: readonly string[]
	completedAt: Date
}

// CAP-019-R29, CAP-021-R25, CAP-021-R32, CAP-015-R35, CAP-015-R36, CAP-015-S51, Q-076
function settleStepOfCheck(check: Exclude<ClosureCheck, typeof CLOSURE_CHECK.READY>): SettleStep {
	switch (check) {
		case CLOSURE_CHECK.REJECTED:
			return CLOSING_STATE.REJECTED
		case CLOSURE_CHECK.UNREADABLE:
			return CLOSING_STATE.UNREADABLE
		case CLOSURE_CHECK.ON_OTHER_DEVICE:
			return CLOSING_STATE.OTHER_DEVICE
		case CLOSURE_CHECK.CHANGED:
			return CLOSING_STATE.CHANGED
		case CLOSURE_CHECK.WAIT:
			return TO_QUEUE
		default:
			return check satisfies never
	}
}

// CAP-014-R14, CAP-021-R25, CAP-021-R32, CAP-015-R36, CAP-019-R29, CAP-002-R17, CAP-009-S05, E70, E93, E107, E111, E112, E115, E129, Q-076, Figma 05 H
export function useRecordClosing({
	acquisitionId,
	kind,
	shown,
	shownFiles,
	isNewWound,
	onClosed,
}: Source): RecordClosing {
	const session = useCaptureSession(acquisitionId)
	const [state, setState] = useState<ClosingState>(CLOSING_STATE.IDLE)
	const shownDraft = useRef(shown)
	shownDraft.current = shown
	const photos = useRef(session.photos)
	photos.current = session.photos
	const files = useRef(shownFiles)
	files.current = shownFiles
	const closed = useRef(onClosed)
	closed.current = onClosed

	// CAP-021-R13, CAP-021-R25, CAP-021-R32
	const close = useCallback(async (fresh: AcquisitionDraft, confirmed: Confirmation): Promise<void> => {
		const operator = currentSession()
		if (operator === undefined) {
			throw new NoSessionError()
		}
		const closure = closureOf(
			confirmed.fileKeys.length,
			{ userId: operator.user.id, sessionId: operator.session_id },
			confirmed.completedAt,
		)
		await withinResponseTime(
			sessionCaller.call((sessionToken) => acquisitionApi.closeAcquisition(sessionToken, fresh, closure)),
		)
	}, [])

	// CAP-019-R29, CAP-021-R25, CAP-021-R32, CAP-015-R35, CAP-015-R36, CAP-015-S51
	const attempt = useCallback(
		async (confirmed: Confirmation, fingerprint: string): Promise<SettleStep> => {
			if (currentSession() === undefined) {
				throw new NoSessionError()
			}
			const fresh = await withinResponseTime(refreshDraft(acquisitionId))
			if (fresh.state === ACQUISITION_STATE_VALUE.RECEIVED) {
				return CLOSING_STATE.CLOSED
			}
			const local = await reconcileFiles(acquisitionId, fresh.files)
			const confirmedRecord = { fileKeys: confirmed.fileKeys, contentFingerprint: fingerprint }
			const check = closureCheckOf(confirmedRecord, fresh, await contentFingerprintOf(fresh), local)
			if (check !== CLOSURE_CHECK.READY) {
				return settleStepOfCheck(check)
			}
			await close(fresh, confirmed)
			return CLOSING_STATE.CLOSED
		},
		[acquisitionId, close],
	)

	// E107, CAP-021-R22
	const missingOfDraft = useCallback(async (): Promise<ClosingState> => {
		const fresh = await refreshDraft(acquisitionId)
		const steps = missingStepsOf({
			draft: fresh,
			fileCount: fresh.files.length,
			isNewWound,
			steps: clinicalSteps(),
		})
		return steps.length === 0 ? CLOSING_STATE.CHANGED : { kind: CLOSING.MISSING, steps }
	}, [acquisitionId, isNewWound])

	// CAP-002-R17, CAP-019-R29, E70, Figma 05 H.3
	const failureStepOf = useCallback(
		async (error: unknown): Promise<SettleStep> => {
			if (error instanceof NoSessionError) {
				return CLOSING_STATE.IDLE
			}
			if (error instanceof NoResponseError && hasUploadsInFlight()) {
				return TO_QUEUE
			}
			const step = closingFailureOf(error)
			return step.kind === MISSING_UNNAMED.kind ? await missingOfDraft() : step
		},
		[missingOfDraft],
	)

	// CAP-019-R29, CAP-019-R10, CAP-019-R02, E70, E93
	const queue = useCallback(
		async (confirmed: Confirmation, fingerprint: string): Promise<ClosingState> => {
			const operator = currentSession()?.user
			if (operator === undefined) {
				return CLOSING_STATE.IDLE
			}
			await queueClosure({
				acquisitionId,
				operatorUserId: operator.id,
				operatorPersonalNumber: operator.personal_number ?? null,
				recordKind: kind,
				fileKeys: confirmed.fileKeys,
				contentFingerprint: fingerprint,
				completedAt: confirmed.completedAt.toISOString(),
			})
			pumpUploads()
			return { kind: CLOSING.QUEUED, remaining: awaitedFilesOf(confirmed.fileKeys, photos.current).length }
		},
		[acquisitionId, kind],
	)

	const settle = useCallback(
		async (confirmed: Confirmation): Promise<ClosingState> => {
			const fingerprint = await contentFingerprintOf(confirmed.draft)
			const step = await attempt(confirmed, fingerprint).catch((error: unknown) => {
				console.warn("the record could not be closed", error)
				return failureStepOf(error)
			})
			return step.kind === TO_QUEUE.kind ? await queue(confirmed, fingerprint) : step
		},
		[attempt, failureStepOf, queue],
	)

	// CAP-014-R23
	useEffect(() => {
		if (state.kind === CLOSING.CLOSED) {
			closed.current()
		}
	}, [state.kind])

	// CAP-021-R25, CAP-021-R32, CAP-015-R35
	const confirm = useCallback(() => {
		const draft = shownDraft.current
		if (draft === undefined) {
			return
		}
		const fileKeys = files.current.map((file) => file.fileKey)
		const confirmed = { draft, fileKeys, completedAt: new Date() }
		retryUploadsNow()
		setState(CLOSING_STATE.CLOSING)
		settle(confirmed)
			.catch((failure: unknown) => {
				console.warn("the closing of the record stopped", acquisitionId, failure)
				return CLOSING_STATE.NO_RESPONSE
			})
			.then(setState)
	}, [acquisitionId, settle])

	const dismiss = useCallback(() => setState(CLOSING_STATE.IDLE), [])

	return { state, confirm, dismiss }
}
