import { ADMIN_API_BASE_PATH, ADMINISTRATION_SESSION_COOKIE } from "@ansora/contracts"
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common"
import type { Response } from "express"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { ADMINISTRATION_HOME, administrationSessionCookie } from "../constants/administration-login.constants"
import { type OidcReturnQueryDto, oidcReturnQuerySchema } from "../dto/oidc-return.input.dto"
import { AdministrationLoginService } from "../services/administration-login.service"

@OutsideMobileContract()
@Controller(ADMIN_API_BASE_PATH)
export class AdministrationLoginController {
	constructor(private readonly logins: AdministrationLoginService) {}

	@Get("login/oidc")
	async startAdministrationLogin(@Res() response: Response): Promise<void> {
		response.redirect(HttpStatus.SEE_OTHER, await this.logins.start())
	}

	@Get("login/oidc/callback")
	async completeAdministrationLogin(
		@Query(new ZodValidationPipe(oidcReturnQuerySchema)) query: OidcReturnQueryDto,
		@Res() response: Response,
	): Promise<void> {
		const issued = await this.logins.complete({
			state: query.state,
			code: query.code,
			error: query.error,
			errorDescription: query.error_description,
		})
		response.cookie(ADMINISTRATION_SESSION_COOKIE, issued.token, administrationSessionCookie(issued.expiresAt))
		response.redirect(HttpStatus.SEE_OTHER, ADMINISTRATION_HOME)
	}
}
