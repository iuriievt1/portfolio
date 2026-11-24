import { Controller, Get, Header, Param, Res, type StreamableFile, UseGuards } from "@nestjs/common"
import type { Response } from "express"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import {
	CACHE_CONTROL_HEADER,
	DOCUMENT_PAGES_PATH,
	FILE_PART,
	NO_STORE,
	PAGE_ID_PARAMETER,
	PAGE_SUBPATH,
	PAGE_THUMBNAIL_SUBPATH,
} from "../constants/image.constants"
import { fileIdSchema } from "../dto/file-id.input.dto"
import { FileReleaseService } from "../services/file-release.service"
import type { ImageDownloadLinkView } from "../types/image.types"
import { originalFileOf, thumbnailFileOf } from "../utils/jpeg-file"

// CAP-020-R17, CAP-020-R18, CAP-020-R22, clinical-workflow.yaml getDocumentPage, getDocumentPageThumbnail
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(DOCUMENT_PAGES_PATH)
export class DocumentPageController {
	constructor(private readonly releases: FileReleaseService) {}

	@Get(PAGE_SUBPATH)
	@Header(CACHE_CONTROL_HEADER, NO_STORE)
	async getDocumentPage(
		@CurrentSession() current: CurrentSessionValue,
		@Param(PAGE_ID_PARAMETER, new ZodValidationPipe(fileIdSchema)) pageId: string,
		@Res({ passthrough: true }) response: Response,
	): Promise<StreamableFile | ImageDownloadLinkView> {
		return originalFileOf(response, await this.releases.documentPage(current, pageId, FILE_PART.ORIGINAL, new Date()))
	}

	// CAP-020-R10
	@Get(PAGE_THUMBNAIL_SUBPATH)
	@Header(CACHE_CONTROL_HEADER, NO_STORE)
	async getDocumentPageThumbnail(
		@CurrentSession() current: CurrentSessionValue,
		@Param(PAGE_ID_PARAMETER, new ZodValidationPipe(fileIdSchema)) pageId: string,
	): Promise<StreamableFile | ImageDownloadLinkView> {
		return thumbnailFileOf(await this.releases.documentPage(current, pageId, FILE_PART.THUMBNAIL, new Date()))
	}
}
