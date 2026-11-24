import { ACQUISITION_VERSION_HEADER, IDEMPOTENCY_KEY_HEADER, REQUEST_KEY_HEADER } from "@ansora/contracts"
import {
	Body,
	Controller,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Put,
	Query,
	Res,
	UseGuards,
} from "@nestjs/common"
import type { Response } from "express"
import { AcceptsOutdatedAppForDraft } from "../../infra/decorators/accepts-outdated-app-for-draft.decorator"
import { type PageInput, pageSchema } from "../../infra/dto/page.input.dto"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import {
	ACQUISITION_ID_PARAMETER,
	ACQUISITION_SUBPATH,
	ACQUISITIONS_PATH,
	ASSIGNMENT_SUBPATH,
} from "../constants/acquisition.constants"
import {
	type AcquisitionAssignmentInput,
	acquisitionAssignmentSchema,
	acquisitionIdSchema,
	acquisitionVersionSchema,
} from "../dto/acquisition-assignment.input.dto"
import {
	type AcquisitionDraftCreateInput,
	acquisitionDraftCreateSchema,
	idempotencyKeySchema,
} from "../dto/acquisition-draft-create.input.dto"
import {
	type AcquisitionDraftUpdateInput,
	acquisitionDraftUpdateSchema,
	requestKeySchema,
} from "../dto/acquisition-draft-update.input.dto"
import { AcquisitionAssignmentService } from "../services/acquisition-assignment.service"
import { AcquisitionDraftService } from "../services/acquisition-draft.service"
import { AcquisitionUpdateService } from "../services/acquisition-update.service"
import type {
	AcquisitionDraftsPageView,
	AcquisitionDraftView,
	AcquisitionReceiptView,
} from "../types/acquisition.types"

// CAP-015-R30, CAP-014-R06, CAP-015-R29, CAP-014-R25
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(ACQUISITIONS_PATH)
export class AcquisitionController {
	constructor(
		private readonly drafts: AcquisitionDraftService,
		private readonly assignments: AcquisitionAssignmentService,
		private readonly updates: AcquisitionUpdateService,
	) {}

	// CAP-021-R29
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async createAcquisitionDraft(
		@CurrentSession() current: CurrentSessionValue,
		@Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKeyHeader: string | undefined,
		@Body(new ZodValidationPipe(acquisitionDraftCreateSchema)) input: AcquisitionDraftCreateInput,
		@Res({ passthrough: true }) response: Response,
	): Promise<AcquisitionReceiptView> {
		const idempotencyKey = new ZodValidationPipe(idempotencyKeySchema).transform(idempotencyKeyHeader)
		const creation = await this.drafts.create(current, input, idempotencyKey, new Date())
		if (!creation.created) {
			response.status(HttpStatus.OK)
		}
		return creation.receipt
	}

	@Get()
	@AcceptsOutdatedAppForDraft()
	async listAcquisitionDrafts(
		@CurrentSession() current: CurrentSessionValue,
		@Query(new ZodValidationPipe(pageSchema)) page: PageInput,
	): Promise<AcquisitionDraftsPageView> {
		return await this.drafts.listOwn(current, page, new Date())
	}

	@Get(ACQUISITION_SUBPATH)
	@AcceptsOutdatedAppForDraft()
	async getAcquisitionDraft(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
	): Promise<AcquisitionDraftView> {
		return await this.drafts.getOwn(current, acquisitionId, new Date())
	}

	// CAP-015-R31, CAP-016-R17, CAP-021-R29, CAP-021-R32
	@Patch(ACQUISITION_SUBPATH)
	@AcceptsOutdatedAppForDraft()
	async updateAcquisitionDraft(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
		@Headers(ACQUISITION_VERSION_HEADER) versionHeader: string | undefined,
		@Headers(REQUEST_KEY_HEADER) requestKeyHeader: string | undefined,
		@Body(new ZodValidationPipe(acquisitionDraftUpdateSchema)) input: AcquisitionDraftUpdateInput,
	): Promise<AcquisitionDraftView> {
		const version = new ZodValidationPipe(acquisitionVersionSchema).transform(versionHeader)
		const requestKey = new ZodValidationPipe(requestKeySchema).transform(requestKeyHeader)
		return await this.updates.update(current, { acquisitionId, version, requestKey, input }, new Date())
	}

	// CAP-014-R07, CAP-021-R32
	@Put(ASSIGNMENT_SUBPATH)
	async setAcquisitionAssignment(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
		@Headers(ACQUISITION_VERSION_HEADER) versionHeader: string | undefined,
		@Body(new ZodValidationPipe(acquisitionAssignmentSchema)) input: AcquisitionAssignmentInput,
	): Promise<AcquisitionDraftView> {
		const version = new ZodValidationPipe(acquisitionVersionSchema).transform(versionHeader)
		return await this.assignments.assign(current, acquisitionId, version, input, new Date())
	}
}
