import { Injectable } from "@nestjs/common"
import { SyncStateRepository } from "../repositories/sync-state.repository"
import type { SyncStateView } from "../types/registry.types"
import { syncStateViewOf } from "../utils/sync-state-view"

// NAB-347, administrace-model-a-api.md 8
@Injectable()
export class SyncStateService {
	constructor(private readonly syncState: SyncStateRepository) {}

	async current(): Promise<SyncStateView> {
		return syncStateViewOf(await this.syncState.latestRun(), await this.syncState.cachedPatientCount())
	}
}
