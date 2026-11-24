import { ADMIN_API_BASE_PATH, ADMINISTRATION_SESSION_COOKIE } from "@ansora/contracts"
import { Controller, Delete, Get, HttpCode, HttpStatus, Res, UseGuards } from "@nestjs/common"
import type { Response } from "express"
import { KeepsIdleTime } from "../../administration-session/decorators/keeps-idle-time.decorator"
import { AdministrationSessionService } from "../../administration-session/services/administration-session.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { administrationSessionCookie } from "../constants/administration-login.constants"
import { UserAdministrationService } from "../services/user-administration.service"
import type { AdministrationSessionView } from "../types/administration-login.types"

@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@Controller(ADMIN_API_BASE_PATH)
export class AdministrationSessionController {
	constructor(
		private readonly sessions: AdministrationSessionService,
		private readonly users: UserAdministrationService,
	) {}

	@Get("session")
	@KeepsIdleTime()
	async getAdministrationSession(
		@Administrator() administrator: AdministrationSession,
	): Promise<AdministrationSessionView> {
		const user = await this.users.detail(administrator.userId)
		const times = await this.sessions.timesOf(administrator)
		return {
			user,
			roles: user.roles,
			idle_expires_at: times.idleExpiresAt.toISOString(),
			expires_at: times.expiresAt.toISOString(),
		}
	}

	@Delete("session")
	@HttpCode(HttpStatus.NO_CONTENT)
	async terminateAdministrationSession(
		@Administrator() administrator: AdministrationSession,
		@Res({ passthrough: true }) response: Response,
	): Promise<void> {
		await this.sessions.terminate(administrator)
		response.clearCookie(ADMINISTRATION_SESSION_COOKIE, administrationSessionCookie(undefined))
	}
}
