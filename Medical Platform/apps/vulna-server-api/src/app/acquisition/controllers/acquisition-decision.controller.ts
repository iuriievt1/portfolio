import { ACQUISITION_VERSION_HEADER } from "@ansora/contracts"
import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common"
import { AcceptsOutdatedAppForDraft } from "../../infra/decorators/accepts-outdated-app-for-draft.decorator"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import { ACQUISITION_ID_PARAMETER, ACQUISITIONS_PATH } from "../constants/acquisition.constants"
import { CANCELLATION_SUBPATH, CLOSURE_SUBPATH, DISCARD_SUBPATH } from "../constants/acquisition-file.constants"
import { acquisitionIdSchema, acquisitionVersionSchema } from "../dto/acquisition-assignment.input.dto"
import {
	type AcquisitionClosureInput,
	type AcquisitionDiscardInput,
	acquisitionClosureSchema,
	acquisitionDiscardSchema,
} from "../dto/acquisition-closure.input.dto"
import { AcquisitionCancellationService } from "../services/acquisition-cancellation.service"
import { AcquisitionClosureService } from "../services/acquisition-closure.service"
import { AcquisitionDiscardService } from "../services/acquisition-discard.service"
import type { AcquisitionReceiptView } from "../types/acquisition.types"

// CAP-014-R14, CAP-015-R17, CAP-015-R37, CAP-021-R25, CAP-021-R29, CAP-021-R32
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(ACQUISITIONS_PATH)
export class AcquisitionDecisionController {
	constructor(
		private readonly closures: AcquisitionClosureService,
		private readonly discards: AcquisitionDiscardService,
		private readonly cancellations: AcquisitionCancellationService,
	) {}

	// CAP-014-R14, CAP-021-R25
	@Post(CLOSURE_SUBPATH)
	@AcceptsOutdatedAppForDraft()
	@HttpCode(HttpStatus.OK)
	async closeAcquisition(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
		@Headers(ACQUISITION_VERSION_HEADER) versionHeader: string | undefined,
		@Body(new ZodValidationPipe(acquisitionClosureSchema)) input: AcquisitionClosureInput,
	): Promise<AcquisitionReceiptView> {
		const version = new ZodValidationPipe(acquisitionVersionSchema).transform(versionHeader)
		return await this.closures.close(
			current,
			{
				acquisitionId,
				version,
				fileCount: input.file_count ?? undefined,
				completedAt: new Date(input.completed_at),
				operator: { userId: input.operator.user_id, sessionId: input.operator.session_id },
			},
			new Date(),
		)
	}

	// CAP-015-R17, CAP-025-R20
	@Post(DISCARD_SUBPATH)
	@HttpCode(HttpStatus.NO_CONTENT)
	async discardAcquisitionDraft(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
		@Headers(ACQUISITION_VERSION_HEADER) versionHeader: string | undefined,
		@Body(new ZodValidationPipe(acquisitionDiscardSchema)) input: AcquisitionDiscardInput,
	): Promise<void> {
		const version = new ZodValidationPipe(acquisitionVersionSchema).transform(versionHeader)
		await this.discards.discard(current, { acquisitionId, version, situation: input.situation }, new Date())
	}

	// CAP-015-R37
	@Post(CANCELLATION_SUBPATH)
	@HttpCode(HttpStatus.NO_CONTENT)
	async cancelAcquisitionDraft(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
	): Promise<void> {
		await this.cancellations.cancel(current, acquisitionId, new Date())
	}
}
