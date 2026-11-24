import { ACCEPT_LANGUAGE_HEADER, CONTENT_LANGUAGE_HEADER } from "@ansora/contracts"
import { Controller, Get, HttpStatus, Query, Req, Res } from "@nestjs/common"
import type { Request, Response } from "express"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { LocalizationService } from "../../localization/localization.service"
import { type OidcReturnQueryDto, oidcReturnQuerySchema } from "../dto/oidc-return.input.dto"
import { ReturnNotAcceptedException } from "../exceptions/return-not-accepted.exception"
import { OidcLoginService } from "../services/oidc-login.service"

@OutsideMobileContract()
@Controller("login/oidc")
export class OidcReturnController {
	constructor(
		private readonly oidc: OidcLoginService,
		private readonly localization: LocalizationService,
	) {}

	@Get("return")
	async oidcReturn(
		@Query(new ZodValidationPipe(oidcReturnQuerySchema)) query: OidcReturnQueryDto,
		@Req() request: Request,
		@Res() response: Response,
	): Promise<void> {
		try {
			const appUrl = await this.oidc.processReturn({
				state: query.state,
				code: query.code,
				error: query.error,
				errorDescription: query.error_description,
			})
			response.redirect(HttpStatus.FOUND, appUrl)
		} catch (error) {
			if (!(error instanceof ReturnNotAcceptedException)) {
				throw error
			}
			// CAP-015-R27
			const { texts, contentLanguage } = await this.localization.responseTexts(request.get(ACCEPT_LANGUAGE_HEADER))
			response.setHeader(CONTENT_LANGUAGE_HEADER, contentLanguage)
			response.status(HttpStatus.BAD_REQUEST).type("text/plain").send(texts.loginReturn.notAccepted)
		}
	}
}
