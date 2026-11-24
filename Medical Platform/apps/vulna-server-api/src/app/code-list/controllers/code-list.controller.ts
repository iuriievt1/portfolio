import { ACCEPT_LANGUAGE_HEADER, CONTENT_LANGUAGE_HEADER } from "@ansora/contracts"
import { Controller, Get, Headers, Query, Res, UseGuards } from "@nestjs/common"
import type { Response } from "express"
import { AcceptsOutdatedAppForDraft } from "../../infra/decorators/accepts-outdated-app-for-draft.decorator"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import { CODE_LISTS_PATH } from "../constants/code-list.constants"
import { type CodeListSyncInput, codeListSyncSchema } from "../dto/code-list.input.dto"
import { CodeListService } from "../services/code-list.service"
import type { CodeListSet } from "../types/code-list.types"

// CAP-017-R10, CAP-016-R07, CAP-024
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(CODE_LISTS_PATH)
export class CodeListController {
	constructor(private readonly codeLists: CodeListService) {}

	@Get()
	@AcceptsOutdatedAppForDraft()
	async syncCodeLists(
		@Query(new ZodValidationPipe(codeListSyncSchema)) input: CodeListSyncInput,
		@Headers(ACCEPT_LANGUAGE_HEADER) acceptLanguage: string | undefined,
		@Res({ passthrough: true }) response: Response,
	): Promise<CodeListSet> {
		const answer = await this.codeLists.codeListSet(input.known_version, acceptLanguage)
		response.setHeader(CONTENT_LANGUAGE_HEADER, answer.contentLanguage)
		return answer.set
	}
}
