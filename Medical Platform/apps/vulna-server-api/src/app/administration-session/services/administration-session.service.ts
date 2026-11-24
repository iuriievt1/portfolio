import { ADMINISTRATION_ERROR_CODE, AUDIT_SCOPE } from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	IDENTITY_PROVIDER_FAILURE,
	PERMISSION,
	randomSecret,
	secondsAfter,
	sha256Hex,
} from "@ansora/core-server"
import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { AppUserRepository } from "../../login/repositories/app-user.repository"
import { LoginPolicyService } from "../../login/services/login-policy.service"
import { UserIdentityService } from "../../login/services/user-identity.service"
import type { LoginPolicy } from "../../login/types/login-policy.types"
import {
	ADMINISTRATION_SESSION_END_REASON,
	type AdministrationSessionEndReason,
} from "../constants/administration-session.constants"
import { AdministrationSessionRepository } from "../repositories/administration-session.repository"
import type {
	AdministrationSession,
	AdministrationSessionEnd,
	AdministrationSessionRow,
	AdministrationSessionTimes,
	IssuedAdministrationSession,
} from "../types/administration-session.types"

@Injectable()
export class AdministrationSessionService {
	private readonly logger = new Logger(AdministrationSessionService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly sessions: AdministrationSessionRepository,
		private readonly policies: LoginPolicyService,
		private readonly users: AppUserRepository,
		private readonly identities: UserIdentityService,
		private readonly audit: AuditRepository,
	) {}

	async issue(sql: postgres.TransactionSql, userId: string, now: Date): Promise<IssuedAdministrationSession> {
		const { administration } = await this.policies.current()
		const token = randomSecret()
		const expiresAt = secondsAfter(now, administration.sessionMaxSeconds)
		const sessionId = await this.sessions.insert(sql, {
			userId,
			tokenHash: sha256Hex(token),
			createdAt: now,
			expiresAt,
		})
		return { sessionId, token, expiresAt }
	}

	async resolve(token: string, keepsIdleTime: boolean): Promise<AdministrationSession | undefined> {
		const row = await this.sessions.findByTokenHash(sha256Hex(token))
		if (row === undefined || row.ended_at !== null) {
			return undefined
		}
		const now = new Date()
		const session = { sessionId: row.id, userId: row.user_id }
		const reason = await this.endReasonOf(row, now)
		if (reason !== undefined) {
			await this.finish({ ...session, reason }, now)
			return undefined
		}
		const permissions = await this.identities.permissionsOf(this.database.sql, row.user_id)
		// CAP-003-R13
		if (!permissions.includes(PERMISSION.ADMINISTRATION_ACCESS)) {
			await this.finish({ ...session, reason: ADMINISTRATION_SESSION_END_REASON.ACCESS_REVOKED }, now)
			return undefined
		}
		if (!keepsIdleTime) {
			await this.sessions.touch(row.id, now)
		}
		return { ...session, permissions }
	}

	async timesOf(session: AdministrationSession): Promise<AdministrationSessionTimes> {
		const row = await this.sessions.findById(session.sessionId)
		if (row === undefined) {
			throw new Error(`administration session ${session.sessionId} disappeared while in use`)
		}
		const { administration } = await this.policies.current()
		return {
			idleExpiresAt: secondsAfter(row.last_activity_at, administration.idleLogoutSeconds),
			expiresAt: row.expires_at,
		}
	}

	async terminate(session: AdministrationSession): Promise<void> {
		await this.finish({ ...session, reason: ADMINISTRATION_SESSION_END_REASON.LOGOUT }, new Date())
	}

	// CAP-002-R10, CAP-002-R11
	async endAllOf(
		sql: postgres.TransactionSql,
		userId: string,
		reason: AdministrationSessionEndReason,
		now: Date,
	): Promise<void> {
		for (const sessionId of await this.sessions.endAllOf(sql, userId, reason, now)) {
			await this.audit.append(sql, terminationEvent({ sessionId, userId, reason }))
		}
	}

	private async endReasonOf(
		row: AdministrationSessionRow,
		now: Date,
	): Promise<AdministrationSessionEndReason | undefined> {
		const policy = await this.policies.current()
		if (row.expires_at.getTime() <= now.getTime()) {
			return ADMINISTRATION_SESSION_END_REASON.EXPIRED
		}
		if (secondsAfter(row.last_activity_at, policy.administration.idleLogoutSeconds).getTime() <= now.getTime()) {
			return ADMINISTRATION_SESSION_END_REASON.IDLE
		}
		if (!row.is_active) {
			return ADMINISTRATION_SESSION_END_REASON.ACCESS_REVOKED
		}
		if (!(await this.confirmedByProvider(row, policy, now))) {
			return ADMINISTRATION_SESSION_END_REASON.PROVIDER_REJECTED
		}
		return undefined
	}

	// CAP-004-R06
	private async confirmedByProvider(row: AdministrationSessionRow, policy: LoginPolicy, now: Date): Promise<boolean> {
		if (secondsAfter(row.confirmed_at, policy.session.tokenValiditySeconds).getTime() > now.getTime()) {
			return true
		}
		const user = await this.users.findById(row.user_id)
		if (user === undefined) {
			throw new Error(`administration session ${row.id} names unknown user ${row.user_id}`)
		}
		const confirmation = await this.identities.confirmWithProvider(user, policy, now)
		if (confirmation.ok) {
			await this.sessions.confirm(row.id, now)
			return true
		}
		if (confirmation.failure === IDENTITY_PROVIDER_FAILURE.UNAVAILABLE) {
			throw new ProblemException(HttpStatus.SERVICE_UNAVAILABLE, ADMINISTRATION_ERROR_CODE.RETRY)
		}
		this.logger.log(`The account of administration session ${row.id} was refused: ${confirmation.failure}`)
		return false
	}

	private async finish(end: AdministrationSessionEnd, now: Date): Promise<void> {
		await this.database.sql.begin(async (tx) => {
			if (!(await this.sessions.end(tx, end.sessionId, end.reason, now))) {
				return
			}
			await this.audit.append(tx, terminationEvent(end))
		})
	}
}

function terminationEvent(end: AdministrationSessionEnd): NewAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.SESSION_TERMINATION,
		actorKind: AUDIT_ACTOR_KIND.USER,
		actorUserId: end.userId,
		sessionId: end.sessionId,
		objectId: end.sessionId,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: { scope: AUDIT_SCOPE.ADMINISTRATION, reason: end.reason },
	}
}
