import { ACQUISITION_KIND, IDEMPOTENCY_KEY_HEADER } from "@ansora/contracts"
import {
	Body,
	Controller,
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	UploadedFiles,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common"
import { AcceptsOutdatedAppForDraft } from "../../infra/decorators/accepts-outdated-app-for-draft.decorator"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { ACQUISITION_ID_PARAMETER, ACQUISITIONS_PATH } from "../constants/acquisition.constants"
import {
	DOCUMENTS_SUBPATH,
	IMAGE_PARTS,
	IMAGES_SUBPATH,
	PAGE_PARTS,
	PART,
} from "../constants/acquisition-file.constants"
import { AcceptsUploadPermission, QueueSender } from "../decorators/queue-sender.decorator"
import { acquisitionIdSchema } from "../dto/acquisition-assignment.input.dto"
import { fileKeySchema, imageUploadFieldsSchema, pageUploadFieldsSchema } from "../dto/acquisition-file.input.dto"
import { QueueSenderGuard } from "../guards/queue-sender.guard"
import { AcquisitionMultipartInterceptor } from "../interceptors/acquisition-multipart.interceptor"
import { AcquisitionFileUploadService } from "../services/acquisition-file-upload.service"
import type { DocumentPageReceiptView, ImageReceiptView, UploadedParts } from "../types/acquisition-file.types"
import type { QueueSender as QueueSenderValue } from "../types/queue-sender.types"
import { sealedContentOf, textFieldsOf } from "../utils/sealed-content"
import { documentPageReceiptOf, imageReceiptOf } from "../utils/upload-receipt"

// CAP-015-R30, CAP-018-R08, CAP-019-R21, CAP-019-R24, CAP-021-R21, CAP-021-R35, ADR-015, CAP-002-R09
@UseGuards(QueueSenderGuard)
@Controller(ACQUISITIONS_PATH)
export class AcquisitionUploadController {
	constructor(private readonly uploads: AcquisitionFileUploadService) {}

	// ADR-014
	@Post(IMAGES_SUBPATH)
	@AcceptsOutdatedAppForDraft()
	@AcceptsUploadPermission()
	@HttpCode(HttpStatus.CREATED)
	@UseInterceptors(AcquisitionMultipartInterceptor(IMAGE_PARTS))
	async uploadImage(
		@QueueSender() sender: QueueSenderValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
		@Headers(IDEMPOTENCY_KEY_HEADER) fileKeyHeader: string | undefined,
		@UploadedFiles() parts: UploadedParts | undefined,
		@Body() body: unknown,
	): Promise<ImageReceiptView> {
		const fileKey = new ZodValidationPipe(fileKeySchema).transform(fileKeyHeader)
		const fields = new ZodValidationPipe(imageUploadFieldsSchema).transform(textFieldsOf(body))
		const file = await this.uploads.upload(
			sender,
			{
				acquisitionId,
				fileKey,
				kind: ACQUISITION_KIND.PHOTO,
				sha256: fields.sha256,
				proposedSequence: fields.sequence,
				content: sealedContentOf(parts, PART.IMAGE, fields),
			},
			new Date(),
		)
		return imageReceiptOf(file)
	}

	// CAP-018-R11, CAP-021-S09
	@Post(DOCUMENTS_SUBPATH)
	@AcceptsOutdatedAppForDraft()
	@AcceptsUploadPermission()
	@HttpCode(HttpStatus.CREATED)
	@UseInterceptors(AcquisitionMultipartInterceptor(PAGE_PARTS))
	async uploadDocumentPage(
		@QueueSender() sender: QueueSenderValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
		@Headers(IDEMPOTENCY_KEY_HEADER) fileKeyHeader: string | undefined,
		@UploadedFiles() parts: UploadedParts | undefined,
		@Body() body: unknown,
	): Promise<DocumentPageReceiptView> {
		const fileKey = new ZodValidationPipe(fileKeySchema).transform(fileKeyHeader)
		const fields = new ZodValidationPipe(pageUploadFieldsSchema).transform(textFieldsOf(body))
		const file = await this.uploads.upload(
			sender,
			{
				acquisitionId,
				fileKey,
				kind: ACQUISITION_KIND.SCAN,
				sha256: fields.sha256,
				proposedSequence: fields.sequence,
				content: sealedContentOf(parts, PART.PAGE, fields),
			},
			new Date(),
		)
		return documentPageReceiptOf(file)
	}
}
