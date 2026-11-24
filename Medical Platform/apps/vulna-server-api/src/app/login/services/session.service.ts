import { ERROR_CODE } from "@ansora/contracts"
import {
	randomSecret,
	SESSION_END_REASON,
	SESSION_OUTCOME,
	type SessionEndReason,
	secondsAfter,
	sha256Hex,
	tokenExpiresAt,
} from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Executor } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { sessionTerminationEventOf } from "../../audit/utils/session-termination-event"
import type { Device } from "../../device/types/device.types"
import { EffectiveConfigurationService } from "../../effective-configuration/services/effective-configuration.service"
import { AppUserRepository } from "../repositories/app-user.repository"
import { SessionRepository } from "../repositories/session.repository"
import { UserDeviceCredentialRepository } from "../repositories/user-device-credential.repository"
import type { AppUser, IssuedSession, SessionResponse, UserSession } from "../types/login.types"
import type { LoginPolicy } from "../types/login-policy.types"
import { loginRejection } from "../utils/login-rejection"
import { UserIdentityService } from "./user-identity.service"

@Injectable()
export class SessionService {
	constructor(
		private readonly sessions: SessionRepository,
		private readonly users: AppUserRepository,
		private readonly credentials: UserDeviceCredentialRepository,
		private readonly identities: UserIdentityService,
		private readonly audit: AuditRepository,
		private readonly effectiveConfiguration: EffectiveConfigurationService,
	) {}

	async resolve(token: string): Promise<UserSession | undefined> {
		return await this.sessions.findByTokenHash(sha256Hex(token))
	}

	async issueOrResume(
		sql: postgres.TransactionSql,
		userId: string,
		deviceId: string,
		policy: LoginPolicy,
		now: Date,
	): Promise<IssuedSession> {
		// CAP-002-R08
		if (!(await this.users.lockActive(sql, userId))) {
			throw loginRejection(ERROR_CODE.ACCOUNT_INACTIVE)
		}
		const active = await this.sessions.activeOnDevice(sql, deviceId, now)
		if (active !== undefined && active.userId === userId) {
			return await this.rotateToken(sql, active, policy, now)
		}
		if (active !== undefined) {
			await this.end(sql, active, SESSION_END_REASON.REPLACED, now)
		}
		const token = randomSecret()
		const sessionEnd = secondsAfter(now, policy.session.sessionMaxSeconds)
		const session = await this.sessions.insert(sql, {
			userId,
			deviceId,
			tokenHash: sha256Hex(token),
			tokenExpiresAt: tokenExpiresAt(now, sessionEnd, policy.session),
			startedAt: now,
			sessionEnd,
		})
		return { session, token, outcome: SESSION_OUTCOME.CREATED }
	}

	async rotateToken(sql: Executor, session: UserSession, policy: LoginPolicy, now: Date): Promise<IssuedSession> {
		const token = randomSecret()
		const expiresAt = tokenExpiresAt(now, session.sessionEnd, policy.session)
		await this.sessions.rotateToken(sql, session.id, sha256Hex(token), expiresAt, now)
		return { session: { ...session, tokenExpiresAt: expiresAt }, token, outcome: SESSION_OUTCOME.RESUMED }
	}

	// CAP-002-R10
	async endAllOf(sql: postgres.TransactionSql, userId: string, reason: SessionEndReason, now: Date): Promise<void> {
		for (const session of await this.sessions.activeOfUser(sql, userId, now)) {
			await this.end(sql, session, reason, now)
		}
	}

	async end(sql: postgres.TransactionSql, session: UserSession, reason: SessionEndReason, now: Date): Promise<void> {
		await this.sessions.end(sql, session.id, reason, now)
		await this.audit.append(sql, sessionTerminationEventOf(session, reason))
	}

	async respond(
		sql: Executor,
		issued: IssuedSession,
		user: AppUser,
		device: Device,
		policy: LoginPolicy,
	): Promise<SessionResponse> {
		const roles = await this.identities.rolesOf(sql, user.id)
		const credential = await this.credentials.find(user.id, device.id, sql)
		const response: SessionResponse = {
			session_id: issued.session.id,
			session_outcome: issued.outcome,
			session_token: issued.token,
			token_expires_at: issued.session.tokenExpiresAt.toISOString(),
			session_end: issued.session.sessionEnd.toISOString(),
			inactivity_lock_seconds: policy.idleLockSeconds,
			user: {
				id: user.id,
				display_name: user.displayName,
				roles,
				preferred_language: user.preferredLanguage,
			},
			effective_configuration: await this.effectiveConfiguration.forDevice(device),
		}
		if (user.personalNumber !== null) {
			response.user.personal_number = user.personalNumber
		}
		const lastFullLoginAt = credential?.lastFullLoginAt
		if (lastFullLoginAt !== undefined && lastFullLoginAt !== null) {
			response.full_login_until = secondsAfter(lastFullLoginAt, policy.fullLoginIntervalSeconds).toISOString()
		}
		return response
	}
}
