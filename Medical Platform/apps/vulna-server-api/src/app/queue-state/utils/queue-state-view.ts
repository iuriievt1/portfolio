import { ACQUISITION_STATE_VALUE } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import type { ReceivedFileKeyRow } from "../../acquisition/types/acquisition-file.types"
import type { AcquisitionStateView, QueueStateRow } from "../types/queue-state.types"

// clinical-workflow.yaml AcquisitionState, CAP-019-R24, CAP-019-R28
export function acquisitionStateOf(row: QueueStateRow, receivedFileKeys: readonly string[]): AcquisitionStateView {
	return {
		idempotency_key: row.idempotency_key,
		acquisition_id: row.id,
		state: row.state === ACQUISITION_STATE.DRAFT ? ACQUISITION_STATE_VALUE.DRAFT : ACQUISITION_STATE_VALUE.RECEIVED,
		received_file_keys: [...receivedFileKeys],
		missing_sequences: [],
		reason: null,
	}
}

export function receivedKeysByAcquisition(rows: readonly ReceivedFileKeyRow[]): Map<string, string[]> {
	const keys = new Map<string, string[]>()
	for (const row of rows) {
		keys.set(row.acquisition_id, [...(keys.get(row.acquisition_id) ?? []), row.file_key])
	}
	return keys
}
