import { AUDIT_SCOPE, type ErrorCode } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME, LOGIN_METHOD, type LoginMethod } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { LoginAttemptRepository } from "../repositories/login-attempt.repository"
import type { AttemptRecord, FailureState } from "../types/login.types"

// identity.yaml loginWithBarcode
const CARRIER_METHODS: readonly LoginMethod[] = [LOGIN_METHOD.CARD, LOGIN_METHOD.QR, LOGIN_METHOD.BARCODE]

const COUNTED_TOGETHER: Record<LoginMethod, readonly LoginMethod[]> = {
	[LOGIN_METHOD.OIDC]: [LOGIN_METHOD.OIDC],
	[LOGIN_METHOD.CARD]: CARRIER_METHODS,
	[LOGIN_METHOD.QR]: CARRIER_METHODS,
	[LOGIN_METHOD.BARCODE]: CARRIER_METHODS,
	[LOGIN_METHOD.PIN]: [LOGIN_METHOD.PIN],
}

@Injectable()
export class LoginAttemptService {
	constructor(
		private readonly database: DatabaseService,
		private readonly attempts: LoginAttemptRepository,
		private readonly audit: AuditRepository,
	) {}

	async record(sql: postgres.TransactionSql, attempt: AttemptRecord, now: Date): Promise<void> {
		const outcome = attempt.reason === undefined ? AUDIT_OUTCOME.SUCCESS : AUDIT_OUTCOME.FAILURE
		await this.attempts.insert(
			sql,
			{
				deviceId: attempt.deviceId,
				userId: attempt.userId,
				method: attempt.method,
				outcome,
				reason: attempt.reason ?? null,
				sessionId: attempt.sessionId,
			},
			now,
		)
		await this.audit.append(sql, {
			eventType: AUDIT_EVENT_TYPE.LOGIN,
			actorKind: attempt.userId === null ? AUDIT_ACTOR_KIND.DEVICE : AUDIT_ACTOR_KIND.USER,
			...(attempt.userId === null ? {} : { actorUserId: attempt.userId }),
			actorDeviceId: attempt.deviceId,
			...(attempt.sessionId === null ? {} : { sessionId: attempt.sessionId }),
			outcome,
			details: {
				scope: AUDIT_SCOPE.MOBILE,
				method: attempt.method,
				reason: attempt.reason ?? null,
				...attempt.details,
			},
		})
	}

	async recordFailure(attempt: Omit<AttemptRecord, "sessionId"> & { reason: ErrorCode }, now: Date): Promise<void> {
		await this.database.sql.begin(async (tx) => {
			await this.record(tx, { ...attempt, sessionId: null }, now)
		})
	}

	async failureState(userId: string, deviceId: string, method: LoginMethod): Promise<FailureState> {
		return await this.attempts.failuresSinceLastSuccess(userId, deviceId, COUNTED_TOGETHER[method])
	}
}
