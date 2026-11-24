import { type BufferedFile, type Reconciliation, reconciliationsOf, SERVER_FILE_STATUS } from "@ansora/core-mobile"
import type { QueueStatesPage } from "../../api/queue"
import { isAwaitingServer } from "./waiting-files"

type AcquisitionState = QueueStatesPage["items"][number]

// CAP-019-R24, CAP-019-R12
export function awaitedRecordsOf(files: readonly BufferedFile[]): Set<string> {
	return new Set(files.filter(isAwaitingServer).map((file) => file.acquisitionId))
}

// CAP-019-R24, CAP-019-R12, CAP-019-R30, CAP-026-R08
export function receiptReconciliationsOf(
	files: readonly BufferedFile[],
	states: readonly AcquisitionState[],
): Reconciliation[] {
	const awaited = awaitedRecordsOf(files)
	return states.flatMap((state) => {
		const acquisitionId = state.acquisition_id ?? undefined
		if (acquisitionId === undefined || !awaited.has(acquisitionId)) {
			return []
		}
		const received = (state.received_file_keys ?? []).map((fileKey) => ({
			file_key: fileKey,
			status: SERVER_FILE_STATUS.RECEIVED,
		}))
		return reconciliationsOf(
			files.filter((file) => file.acquisitionId === acquisitionId),
			received,
		)
	})
}
