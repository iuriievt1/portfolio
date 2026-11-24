import { Controller, Get, Param, UseGuards } from "@nestjs/common"
import { ACQUISITION_ID_PARAMETER, ACQUISITIONS_PATH } from "../../acquisition/constants/acquisition.constants"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import { DETAIL_SUBPATH } from "../constants/acquisition-detail.constants"
import { acquisitionIdSchema } from "../dto/acquisition-detail.input.dto"
import { AcquisitionDetailService } from "../services/acquisition-detail.service"
import type { AcquisitionDetailView } from "../types/acquisition-detail.types"

// CAP-020-R17, clinical-workflow.yaml getAcquisition
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(ACQUISITIONS_PATH)
export class AcquisitionDetailController {
	constructor(private readonly details: AcquisitionDetailService) {}

	@Get(DETAIL_SUBPATH)
	async getAcquisition(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
	): Promise<AcquisitionDetailView> {
		return await this.details.detail(current, acquisitionId, new Date())
	}
}
