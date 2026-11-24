import { PERMISSION } from "@ansora/core-server"
import { Controller, Get, UseGuards } from "@nestjs/common"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { SYNC_STATE_PATH } from "../constants/registry.constants"
import { SyncStateService } from "../services/sync-state.service"
import type { SyncStateView } from "../types/registry.types"

// NAB-347, administrace-model-a-api.md 8
@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@Controller(SYNC_STATE_PATH)
export class SyncStateController {
	constructor(private readonly syncState: SyncStateService) {}

	@Get()
	@RequiresPermission(PERMISSION.ADMINISTRATION_ACCESS)
	async getSyncState(): Promise<SyncStateView> {
		return await this.syncState.current()
	}
}
