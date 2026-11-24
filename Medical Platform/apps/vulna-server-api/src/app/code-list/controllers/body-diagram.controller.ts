import { bodyDiagramSvg, ERROR_CODE } from "@ansora/contracts"
import { bodyDiagramRelease } from "@ansora/vulna-domain"
import { Controller, Get, Header, HttpStatus, Param, UseGuards } from "@nestjs/common"
import { AcceptsOutdatedAppForDraft } from "../../infra/decorators/accepts-outdated-app-for-draft.decorator"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import {
	BACKGROUND_SUBPATH,
	BODY_DIAGRAM_VERSION_PARAMETER,
	BODY_DIAGRAMS_PATH,
	CONTENT_TYPE_HEADER,
	SVG_CONTENT_TYPE,
} from "../constants/code-list.constants"
import { bodyDiagramVersionSchema } from "../dto/code-list.input.dto"

// CAP-016-R07, CAP-016-R08, ADR-023
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(BODY_DIAGRAMS_PATH)
export class BodyDiagramController {
	@Get(BACKGROUND_SUBPATH)
	@AcceptsOutdatedAppForDraft()
	@Header(CONTENT_TYPE_HEADER, SVG_CONTENT_TYPE)
	getBodyDiagramBackground(
		@Param(BODY_DIAGRAM_VERSION_PARAMETER, new ZodValidationPipe(bodyDiagramVersionSchema)) version: string,
	): string {
		const release = bodyDiagramRelease(version)
		if (release === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		return bodyDiagramSvg(release)
	}
}
