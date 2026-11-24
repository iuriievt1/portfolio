import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common"
import type { Request } from "express"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { type OidcCallbackDto, oidcCallbackSchema } from "../dto/oidc-callback.input.dto"
import { type OidcStartDto, oidcStartSchema } from "../dto/oidc-start.input.dto"
import { type PinLoginDto, pinLoginSchema } from "../dto/pin-login.input.dto"
import { signedBodySchema } from "../dto/signed-body.input.dto"
import { LoginChallengeService } from "../services/login-challenge.service"
import { OidcLoginService } from "../services/oidc-login.service"
import { QuickLoginService } from "../services/quick-login.service"
import type { ChallengeResponse, OidcStartResponse, SessionResponse } from "../types/login.types"

@Controller("login")
export class LoginController {
	constructor(
		private readonly oidc: OidcLoginService,
		private readonly challenges: LoginChallengeService,
		private readonly quick: QuickLoginService,
	) {}

	@Post("oidc")
	@HttpCode(HttpStatus.OK)
	async startOidcLogin(
		@Req() request: Request,
		@Body(new ZodValidationPipe(oidcStartSchema)) input: OidcStartDto,
	): Promise<OidcStartResponse> {
		return await this.oidc.start(request, input)
	}

	@Post("oidc/callback")
	@HttpCode(HttpStatus.OK)
	async completeOidcLogin(
		@Req() request: Request,
		@Body(new ZodValidationPipe(oidcCallbackSchema)) input: OidcCallbackDto,
	): Promise<SessionResponse> {
		return await this.oidc.complete(request, input)
	}

	@Post("challenge")
	@HttpCode(HttpStatus.OK)
	async issueChallenge(@Req() request: Request): Promise<ChallengeResponse> {
		return await this.challenges.issue(request)
	}

	@Post("card")
	@HttpCode(HttpStatus.OK)
	async loginWithCard(
		@Req() request: Request,
		@Body(new ZodValidationPipe(signedBodySchema)) body: string,
	): Promise<SessionResponse> {
		return await this.quick.loginWithCard(request, body)
	}

	@Post("qr")
	@HttpCode(HttpStatus.OK)
	async loginWithQrCode(
		@Req() request: Request,
		@Body(new ZodValidationPipe(signedBodySchema)) body: string,
	): Promise<SessionResponse> {
		return await this.quick.loginWithQrCode(request, body)
	}

	@Post("barcode")
	@HttpCode(HttpStatus.OK)
	async loginWithBarcode(
		@Req() request: Request,
		@Body(new ZodValidationPipe(signedBodySchema)) body: string,
	): Promise<SessionResponse> {
		return await this.quick.loginWithBarcode(request, body)
	}

	@Post("pin")
	@HttpCode(HttpStatus.OK)
	async loginWithPin(
		@Req() request: Request,
		@Body(new ZodValidationPipe(pinLoginSchema)) input: PinLoginDto,
	): Promise<SessionResponse> {
		return await this.quick.loginWithPin(request, input)
	}
}
