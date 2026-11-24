import { ACQUISITION_VERSION_HEADER } from "@ansora/contracts"
import {
	Body,
	Controller,
	Delete,
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	UploadedFiles,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common"
import { AcceptsOutdatedAppForDraft } from "../../infra/decorators/accepts-outdated-app-for-draft.decorator"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import { ACQUISITION_ID_PARAMETER, ACQUISITIONS_PATH } from "../constants/acquisition.constants"
import {
	FILE_KEY_PARAMETER,
	FILE_ORDER_SUBPATH,
	FILE_SUBPATH,
	PART,
	REPLACEMENT_PARTS,
} from "../constants/acquisition-file.constants"
import { acquisitionIdSchema, acquisitionVersionSchema } from "../dto/acquisition-assignment.input.dto"
import {
	type AcquisitionFileOrderInput,
	acquisitionFileOrderSchema,
	fileKeySchema,
	fileReplacementFieldsSchema,
} from "../dto/acquisition-file.input.dto"
import { AcquisitionMultipartInterceptor } from "../interceptors/acquisition-multipart.interceptor"
import { AcquisitionFileOrderService } from "../services/acquisition-file-order.service"
import { AcquisitionFileRemovalService } from "../services/acquisition-file-removal.service"
import { AcquisitionFileReplacementService } from "../services/acquisition-file-replacement.service"
import type { AcquisitionDraftView } from "../types/acquisition.types"
import type { AcquisitionDraftFileView, UploadedParts } from "../types/acquisition-file.types"
import { sealedContentOf, textFieldsOf } from "../utils/sealed-content"

// CAP-015-R18, CAP-015-R33, CAP-015-R34, CAP-015-R35, CAP-015-R36, CAP-018-R11, CAP-021-R32
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(ACQUISITIONS_PATH)
export class AcquisitionFileController {
	constructor(
		private readonly removals: AcquisitionFileRemovalService,
		private readonly replacements: AcquisitionFileReplacementService,
		private readonly orders: AcquisitionFileOrderService,
	) {}

	// CAP-015-R18, CAP-026-R17
	@Delete(FILE_SUBPATH)
	@AcceptsOutdatedAppForDraft()
	@HttpCode(HttpStatus.NO_CONTENT)
	async removeAcquisitionFile(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
		@Param(FILE_KEY_PARAMETER, new ZodValidationPipe(fileKeySchema)) fileKey: string,
		@Headers(ACQUISITION_VERSION_HEADER) versionHeader: string | undefined,
	): Promise<void> {
		const version = new ZodValidationPipe(acquisitionVersionSchema).transform(versionHeader)
		await this.removals.remove(current, { acquisitionId, fileKey, version }, new Date())
	}

	// CAP-015-R34, CAP-018-R11
	@Put(FILE_SUBPATH)
	@AcceptsOutdatedAppForDraft()
	@UseInterceptors(AcquisitionMultipartInterceptor(REPLACEMENT_PARTS))
	async replaceAcquisitionFile(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
		@Param(FILE_KEY_PARAMETER, new ZodValidationPipe(fileKeySchema)) fileKey: string,
		@Headers(ACQUISITION_VERSION_HEADER) versionHeader: string | undefined,
		@UploadedFiles() parts: UploadedParts | undefined,
		@Body() body: unknown,
	): Promise<AcquisitionDraftFileView> {
		const version = new ZodValidationPipe(acquisitionVersionSchema).transform(versionHeader)
		const fields = new ZodValidationPipe(fileReplacementFieldsSchema).transform(textFieldsOf(body))
		return await this.replacements.replace(
			current,
			{
				acquisitionId,
				fileKey,
				version,
				sha256: fields.sha256,
				edit: fields.edit,
				content: sealedContentOf(parts, PART.FILE, fields),
			},
			new Date(),
		)
	}

	// CAP-015-R33, CAP-018-R11
	@Put(FILE_ORDER_SUBPATH)
	@AcceptsOutdatedAppForDraft()
	async setAcquisitionFileOrder(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
		@Headers(ACQUISITION_VERSION_HEADER) versionHeader: string | undefined,
		@Body(new ZodValidationPipe(acquisitionFileOrderSchema)) input: AcquisitionFileOrderInput,
	): Promise<AcquisitionDraftView> {
		const version = new ZodValidationPipe(acquisitionVersionSchema).transform(versionHeader)
		return await this.orders.reorder(current, { acquisitionId, version, fileKeys: input.file_keys }, new Date())
	}
}
