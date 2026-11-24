import { AUDIT_SCOPE, ERROR_CODE } from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	IDENTITY_PROVIDER_FAILURE,
	SESSION_END_REASON,
	type SessionEndReason,
} from "@ansora/core-server"
import { Injectable, Logger } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { AppUserRepository } from "../repositories/app-user.repository"
import type { CurrentSession, SessionRefreshInput, SessionResponse } from "../types/login.types"
import { loginRejection } from "../utils/login-rejection"
import { LoginPolicyService } from "./login-policy.service"
import { SessionService } from "./session.service"
import { UserIdentityService } from "./user-identity.service"

@Injectable()
export class SessionLifecycleService {
	private readonly logger = new Logger(SessionLifecycleService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly sessions: SessionService,
		private readonly users: AppUserRepository,
		private readonly identities: UserIdentityService,
		private readonly policies: LoginPolicyService,
		private readonly audit: AuditRepository,
	) {}

	async refresh(current: CurrentSession, input: SessionRefreshInput): Promise<SessionResponse> {
		const { session, device } = current
		const now = new Date()
		if (input.session_id !== session.id) {
			throw loginRejection(ERROR_CODE.SIGN_IN_AGAIN)
		}
		const policy = await this.policies.current()
		const user = await this.users.findById(session.userId)
		if (user === undefined || !user.isActive) {
			await this.endWith(current, SESSION_END_REASON.USER_REVOKED, now)
			throw loginRejection(ERROR_CODE.SIGN_IN_AGAIN)
		}
		const confirmation = await this.identities.confirmWithProvider(user, policy, now)
		if (!confirmation.ok) {
			if (confirmation.failure === IDENTITY_PROVIDER_FAILURE.UNAVAILABLE) {
				throw loginRejection(ERROR_CODE.PROVIDER_UNAVAILABLE)
			}
			this.logger.log(`The refresh of session ${session.id} was refused: ${confirmation.failure}`)
			await this.endWith(current, SESSION_END_REASON.PROVIDER_REJECTED, now)
			throw loginRejection(ERROR_CODE.SIGN_IN_AGAIN)
		}
		return await this.database.sql.begin(async (tx) => {
			const issued = await this.sessions.rotateToken(tx, session, policy, now)
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.SESSION_REFRESH,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: user.id,
				actorDeviceId: device.id,
				sessionId: session.id,
				objectId: session.id,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: { scope: AUDIT_SCOPE.MOBILE, token_expires_at: issued.session.tokenExpiresAt.toISOString() },
			})
			return await this.sessions.respond(tx, issued, user, device, policy)
		})
	}

	async terminate(current: CurrentSession): Promise<void> {
		await this.endWith(current, SESSION_END_REASON.LOGOUT, new Date())
	}

	private async endWith(current: CurrentSession, reason: SessionEndReason, now: Date): Promise<void> {
		await this.database.sql.begin(async (tx) => {
			await this.sessions.end(tx, current.session, reason, now)
		})
	}
}
