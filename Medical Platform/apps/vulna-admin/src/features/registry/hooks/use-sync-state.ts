import { callApi } from "@/api/client"
import type { SyncState } from "@/features/registry/types/registry.types"
import { type RequestState, useRequest } from "@/lib/use-request"

const SYNC_STATE_PATH = "/monitoring/sync"

function loadSyncState(): Promise<SyncState> {
	return callApi<SyncState>(SYNC_STATE_PATH)
}

// NAB-347
export function useSyncState(): RequestState<SyncState> {
	return useRequest(loadSyncState)
}
