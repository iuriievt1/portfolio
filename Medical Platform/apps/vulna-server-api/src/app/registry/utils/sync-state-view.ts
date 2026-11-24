import { REGISTRY_SYNC_OUTCOME, SYNC_STATE, type SyncStateValue } from "@ansora/contracts"
import type { SyncRunStateRow, SyncStateView } from "../types/registry.types"

function stateOf(latest: SyncRunStateRow | undefined): SyncStateValue {
	if (latest === undefined) {
		return SYNC_STATE.WAITING
	}
	if (latest.finished_at === null) {
		return SYNC_STATE.RUNNING
	}
	if (latest.failed) {
		return SYNC_STATE.FAILED
	}
	return latest.outcome === REGISTRY_SYNC_OUTCOME.INCOMPLETE ? SYNC_STATE.INCOMPLETE_OUTCOME : SYNC_STATE.WAITING
}

// NAB-347, CAP-024-R04, CAP-024-R05
export function syncStateViewOf(latest: SyncRunStateRow | undefined, cachedPatientCount: number): SyncStateView {
	const view: SyncStateView = { state: stateOf(latest), cached_patient_count: cachedPatientCount }
	if (latest !== undefined) {
		view.last_run_at = latest.started_at.toISOString()
	}
	return view
}
