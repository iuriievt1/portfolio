import { accessTokenHash, isSessionActive, isTokenActive } from "@ansora/core-server"
import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { DeviceProofService } from "../../device/services/device-proof.service"
import { ACCEPTS_EXPIRED_TOKEN } from "../constants/user-session.constants"
import { SessionService } from "../services/session.service"
import type { CurrentSession, UserSession, UserSessionRequest } from "../types/login.types"
import { bearerToken } from "../utils/bearer-token"
import { signInAgain } from "../utils/login-rejection"

@Injectable()
export class UserSessionGuard implements CanActivate {
	constructor(
		private readonly sessions: SessionService,
		private readonly proofs: DeviceProofService,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<UserSessionRequest>()
		const token = bearerToken(request.headers.authorization)
		const session = token === undefined ? undefined : await this.sessions.resolve(token)
		if (token === undefined || session === undefined) {
			throw signInAgain()
		}
		await this.admit(context, token, session)
		return true
	}

	async admit(context: ExecutionContext, token: string, session: UserSession): Promise<CurrentSession> {
		const request = context.switchToHttp().getRequest<UserSessionRequest>()
		if (!this.isUsable(session, context)) {
			throw signInAgain()
		}
		const device = await this.proofs.ofApprovedDevice(request, accessTokenHash(token))
		if (device.id !== session.deviceId) {
			throw signInAgain()
		}
		const current = { session, token, device }
		request.userSession = current
		return current
	}

	private isUsable(session: UserSession, context: ExecutionContext): boolean {
		const now = new Date()
		if (!isSessionActive(session, now)) {
			return false
		}
		const acceptsExpired = this.reflector.get<boolean | undefined>(ACCEPTS_EXPIRED_TOKEN, context.getHandler()) === true
		return acceptsExpired || isTokenActive(session, now)
	}
}
