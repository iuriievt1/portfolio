import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { AcceptsExpiredToken } from "../decorators/accepts-expired-token.decorator"
import { CurrentSession } from "../decorators/current-session.decorator"
import { type SessionRefreshDto, sessionRefreshSchema } from "../dto/session-refresh.input.dto"
import { UserSessionGuard } from "../guards/user-session.guard"
import { SessionLifecycleService } from "../services/session-lifecycle.service"
import type { CurrentSession as CurrentSessionValue, SessionResponse } from "../types/login.types"

@UseGuards(UserSessionGuard)
@Controller("session")
export class SessionController {
	constructor(private readonly sessions: SessionLifecycleService) {}

	@Post("refresh")
	@HttpCode(HttpStatus.OK)
	@AcceptsExpiredToken()
	async refreshSession(
		@CurrentSession() current: CurrentSessionValue,
		@Body(new ZodValidationPipe(sessionRefreshSchema)) input: SessionRefreshDto,
	): Promise<SessionResponse> {
		return await this.sessions.refresh(current, input)
	}

	@Post("termination")
	@HttpCode(HttpStatus.NO_CONTENT)
	async terminateSession(@CurrentSession() current: CurrentSessionValue): Promise<void> {
		await this.sessions.terminate(current)
	}
}
