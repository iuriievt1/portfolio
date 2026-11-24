import { PERMISSION } from "@ansora/core-server"
import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import {
	DELIVERY_TARGETS_PATH,
	TARGET_CODE_PARAMETER,
	TARGET_RESUMPTION_SUBPATH,
} from "../constants/delivery-monitoring.constants"
import { targetCodeSchema } from "../dto/delivery-target.input.dto"
import { DeliveryOverviewService } from "../services/delivery-overview.service"
import { DeliveryTargetResumptionService } from "../services/delivery-target-resumption.service"
import type { DeliveryTargetView } from "../types/delivery-monitoring.types"

// CAP-023-R23, CAP-023-R24, administration.yaml listDeliveryTargets, resumeDeliveryTarget
@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@Controller(DELIVERY_TARGETS_PATH)
export class DeliveryTargetController {
	constructor(
		private readonly overview: DeliveryOverviewService,
		private readonly resumptions: DeliveryTargetResumptionService,
	) {}

	// NAB-345, NAB-397, NAB-534
	@Get()
	@RequiresPermission(PERMISSION.ADMINISTRATION_ACCESS)
	async listDeliveryTargets(): Promise<DeliveryTargetView[]> {
		return await this.overview.targets()
	}

	// CAP-023-S10, CAP-023-S11
	@Post(TARGET_RESUMPTION_SUBPATH)
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequiresPermission(PERMISSION.MONITORING_MANAGE)
	async resumeDeliveryTarget(
		@Param(TARGET_CODE_PARAMETER, new ZodValidationPipe(targetCodeSchema)) targetCode: string,
		@Administrator() administrator: AdministrationSession,
	): Promise<void> {
		await this.resumptions.resume(targetCode, administrator)
	}
}
