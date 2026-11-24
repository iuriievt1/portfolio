import { Controller, Get, Header, Param, Res, type StreamableFile, UseGuards } from "@nestjs/common"
import type { Response } from "express"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import {
	CACHE_CONTROL_HEADER,
	FILE_PART,
	IMAGE_ID_PARAMETER,
	IMAGE_SUBPATH,
	IMAGE_THUMBNAIL_SUBPATH,
	IMAGES_PATH,
	NO_STORE,
} from "../constants/image.constants"
import { fileIdSchema } from "../dto/file-id.input.dto"
import { FileReleaseService } from "../services/file-release.service"
import type { ImageDownloadLinkView } from "../types/image.types"
import { originalFileOf, thumbnailFileOf } from "../utils/jpeg-file"

// CAP-020-R09, CAP-020-R22, clinical-workflow.yaml getImage, getImageThumbnail
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(IMAGES_PATH)
export class ImageController {
	constructor(private readonly releases: FileReleaseService) {}

	@Get(IMAGE_SUBPATH)
	@Header(CACHE_CONTROL_HEADER, NO_STORE)
	async getImage(
		@CurrentSession() current: CurrentSessionValue,
		@Param(IMAGE_ID_PARAMETER, new ZodValidationPipe(fileIdSchema)) imageId: string,
		@Res({ passthrough: true }) response: Response,
	): Promise<StreamableFile | ImageDownloadLinkView> {
		return originalFileOf(response, await this.releases.image(current, imageId, FILE_PART.ORIGINAL, new Date()))
	}

	// CAP-020-R10
	@Get(IMAGE_THUMBNAIL_SUBPATH)
	@Header(CACHE_CONTROL_HEADER, NO_STORE)
	async getImageThumbnail(
		@CurrentSession() current: CurrentSessionValue,
		@Param(IMAGE_ID_PARAMETER, new ZodValidationPipe(fileIdSchema)) imageId: string,
	): Promise<StreamableFile | ImageDownloadLinkView> {
		return thumbnailFileOf(await this.releases.image(current, imageId, FILE_PART.THUMBNAIL, new Date()))
	}
}
