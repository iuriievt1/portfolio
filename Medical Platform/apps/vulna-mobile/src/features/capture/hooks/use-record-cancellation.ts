import { NoSessionError } from "@ansora/core-mobile"
import { useCallback, useRef, useState } from "react"
import { acquisitionApi } from "../../../api/acquisitions"
import { sessionCaller } from "../../session/session-actions"
import { cancellationStateOfError, RECORD_CANCELLATION, type RecordCancellation } from "../record-cancellation"

const IDLE: RecordCancellation = { kind: RECORD_CANCELLATION.IDLE }

export interface RecordClosing {
	cancellation: RecordCancellation
	requestClose: () => void
	leave: () => void
	cancelRecord: () => Promise<void>
	dismissFailure: () => void
}

// CAP-015-R37, CAP-015-S54, CAP-015-S55, CAP-018-S11, CAP-014-R23, CAP-002-R17, E119, E115
export function useRecordCancellation(
	acquisitionId: string,
	isRecordEmpty: boolean,
	onClose: () => void,
): RecordClosing {
	const [cancellation, setCancellation] = useState<RecordCancellation>(IDLE)
	const busy = useRef(false)

	const requestClose = useCallback(() => {
		if (busy.current) {
			return
		}
		if (!isRecordEmpty) {
			onClose()
			return
		}
		setCancellation({ kind: RECORD_CANCELLATION.ASKING })
	}, [isRecordEmpty, onClose])

	const leave = useCallback(() => {
		if (busy.current) {
			return
		}
		setCancellation(IDLE)
		onClose()
	}, [onClose])

	const cancelRecord = useCallback(async () => {
		if (busy.current) {
			return
		}
		busy.current = true
		setCancellation({ kind: RECORD_CANCELLATION.CANCELLING })
		try {
			await sessionCaller.call((sessionToken) => acquisitionApi.cancelAcquisitionDraft(sessionToken, acquisitionId))
			setCancellation(IDLE)
			onClose()
		} catch (error) {
			setCancellation(error instanceof NoSessionError ? IDLE : cancellationStateOfError(error))
		} finally {
			busy.current = false
		}
	}, [acquisitionId, onClose])

	const dismissFailure = useCallback(() => setCancellation(IDLE), [])

	return { cancellation, requestClose, leave, cancelRecord, dismissFailure }
}
