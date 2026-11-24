import { PERMISSION } from "@ansora/core-server"
import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common"
import { ACQUISITION_ID_PARAMETER } from "../../acquisition/constants/acquisition.constants"
import { acquisitionIdSchema } from "../../acquisition-detail/dto/acquisition-detail.input.dto"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { ACQUISITION_SUBPATH, ACQUISITIONS_PATH } from "../constants/acquisition-administration.constants"
import { type AcquisitionSearchInput, acquisitionSearchSchema } from "../dto/acquisition-search.input.dto"
import { AcquisitionAdministrationService } from "../services/acquisition-administration.service"
import type {
	AdministeredAcquisitionsPageView,
	AdministeredAcquisitionView,
} from "../types/acquisition-administration.types"

// CAP-004-R10, CAP-004-S02
@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@Controller(ACQUISITIONS_PATH)
export class AcquisitionAdministrationController {
	constructor(private readonly acquisitions: AcquisitionAdministrationService) {}

	@Get()
	@RequiresPermission(PERMISSION.ACQUISITIONS_READ)
	async searchAcquisitions(
		@Query(new ZodValidationPipe(acquisitionSearchSchema)) query: AcquisitionSearchInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<AdministeredAcquisitionsPageView> {
		return await this.acquisitions.search(administrator, query)
	}

	@Get(ACQUISITION_SUBPATH)
	@RequiresPermission(PERMISSION.ACQUISITIONS_READ)
	async getAcquisitionForAdministration(
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
		@Administrator() administrator: AdministrationSession,
	): Promise<AdministeredAcquisitionView> {
		return await this.acquisitions.detail(administrator, acquisitionId)
	}
}
