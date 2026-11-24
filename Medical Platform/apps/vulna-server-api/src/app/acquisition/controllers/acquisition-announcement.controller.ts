import { IDEMPOTENCY_KEY_HEADER } from "@ansora/contracts"
import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, Res, UseGuards } from "@nestjs/common"
import type { Response } from "express"
import { AcceptsOutdatedAppForDraft } from "../../infra/decorators/accepts-outdated-app-for-draft.decorator"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { ACQUISITION_ID_PARAMETER, ACQUISITIONS_PATH } from "../constants/acquisition.constants"
import { FILES_SUBPATH } from "../constants/acquisition-file.constants"
import { QueueSender } from "../decorators/queue-sender.decorator"
import { acquisitionIdSchema } from "../dto/acquisition-assignment.input.dto"
import {
	type AcquisitionFileAnnouncementInput,
	acquisitionFileAnnouncementSchema,
	fileKeySchema,
} from "../dto/acquisition-file.input.dto"
import { QueueSenderGuard } from "../guards/queue-sender.guard"
import { AcquisitionFileAnnouncementService } from "../services/acquisition-file-announcement.service"
import type { AnnouncementReceiptView } from "../types/acquisition-file.types"
import type { QueueSender as QueueSenderValue } from "../types/queue-sender.types"

// CAP-015-R35, CAP-021-R29, CAP-002-R09, ADR-014
@UseGuards(QueueSenderGuard)
@Controller(ACQUISITIONS_PATH)
export class AcquisitionAnnouncementController {
	constructor(private readonly announcements: AcquisitionFileAnnouncementService) {}

	@Post(FILES_SUBPATH)
	@AcceptsOutdatedAppForDraft()
	@HttpCode(HttpStatus.CREATED)
	async announceAcquisitionFile(
		@QueueSender() sender: QueueSenderValue,
		@Param(ACQUISITION_ID_PARAMETER, new ZodValidationPipe(acquisitionIdSchema)) acquisitionId: string,
		@Headers(IDEMPOTENCY_KEY_HEADER) fileKeyHeader: string | undefined,
		@Body(new ZodValidationPipe(acquisitionFileAnnouncementSchema)) input: AcquisitionFileAnnouncementInput,
		@Res({ passthrough: true }) response: Response,
	): Promise<AnnouncementReceiptView> {
		const fileKey = new ZodValidationPipe(fileKeySchema).transform(fileKeyHeader)
		const announcement = await this.announcements.announce(
			sender,
			{
				acquisitionId,
				fileKey,
				fileKind: input.file_kind,
				sha256: input.sha256,
				proposedSequence: input.proposed_sequence,
				replacesFileKey: input.replaces_file_key,
			},
			new Date(),
		)
		if (!announcement.created) {
			response.status(HttpStatus.OK)
		}
		return {
			file: announcement.file,
			upload_permission: announcement.permission.token,
			upload_permission_expires_at: announcement.permission.expiresAt.toISOString(),
		}
	}
}
