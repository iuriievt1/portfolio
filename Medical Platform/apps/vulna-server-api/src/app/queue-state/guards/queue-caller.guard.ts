import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common"
import { DeviceTokenService } from "../../device/services/device-token.service"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import { SessionService } from "../../login/services/session.service"
import type { UserSessionRequest } from "../../login/types/login.types"
import { bearerToken } from "../../login/utils/bearer-token"
import { signInAgain } from "../../login/utils/login-rejection"
import { QUEUE_CALLER } from "../constants/queue-state.constants"
import type { QueueCaller, QueueCallerRequest } from "../types/queue-state.types"

type CallerRequest = QueueCallerRequest & UserSessionRequest

// CAP-002-R09, CAP-019-R08, CAP-019-R30, NAB-297
@Injectable()
export class QueueCallerGuard implements CanActivate {
	constructor(
		private readonly sessions: SessionService,
		private readonly userSessions: UserSessionGuard,
		private readonly deviceTokens: DeviceTokenService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<CallerRequest>()
		const token = bearerToken(request.headers.authorization)
		if (token === undefined) {
			throw signInAgain()
		}
		request.queueCaller = await this.callerOf(context, request, token)
		return true
	}

	private async callerOf(context: ExecutionContext, request: CallerRequest, token: string): Promise<QueueCaller> {
		const session = await this.sessions.resolve(token)
		if (session === undefined) {
			return { kind: QUEUE_CALLER.DEVICE, device: await this.deviceTokens.provenDeviceOf(request, token, new Date()) }
		}
		return { kind: QUEUE_CALLER.USER, current: await this.userSessions.admit(context, token, session) }
	}
}
