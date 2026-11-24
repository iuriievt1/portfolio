import { ADMINISTRATION_ERROR_CODE, ADMINISTRATION_SESSION_COOKIE } from "@ansora/contracts"
import type { Permission } from "@ansora/core-server"
import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import {
	KEEPS_IDLE_TIME,
	REQUIRED_PERMISSION,
} from "../../administration-session/constants/administration-session.constants"
import { AdministrationSessionService } from "../../administration-session/services/administration-session.service"
import type { AdministrationRequest } from "../../administration-session/types/administration-session.types"
import { ProblemException } from "../exceptions/problem.exception"
import { isBackgroundRefresh } from "../utils/background-refresh"
import { cookieValue } from "../utils/cookies"
import { isCrossSiteRequest } from "../utils/cross-site-request"

@Injectable()
export class AdministrationSessionGuard implements CanActivate {
	constructor(
		private readonly sessions: AdministrationSessionService,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AdministrationRequest>()
		if (isCrossSiteRequest(request)) {
			throw new ProblemException(HttpStatus.FORBIDDEN, ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		}
		const token = cookieValue(request.headers.cookie, ADMINISTRATION_SESSION_COOKIE)
		const keepsIdleTime =
			this.reflector.get<boolean | undefined>(KEEPS_IDLE_TIME, context.getHandler()) === true ||
			isBackgroundRefresh(request)
		const session = token === undefined ? undefined : await this.sessions.resolve(token, keepsIdleTime)
		if (session === undefined) {
			throw new ProblemException(HttpStatus.UNAUTHORIZED, ADMINISTRATION_ERROR_CODE.REAUTHENTICATION_REQUIRED)
		}
		const required = this.reflector.getAllAndOverride<Permission | undefined>(REQUIRED_PERMISSION, [
			context.getHandler(),
			context.getClass(),
		])
		// CAP-003-R13
		if (required !== undefined && !session.permissions.includes(required)) {
			throw new ProblemException(HttpStatus.FORBIDDEN, ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		}
		request.administrationSession = session
		return true
	}
}
