import { randomUUID } from "node:crypto"
import { AUDIT_OUTCOME, type LoginMethod } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import type { FailureState, LoginAttempt } from "../types/login.types"

interface FailureRow {
	count: number
	last_failed_at: Date | null
}

@Injectable()
export class LoginAttemptRepository {
	constructor(private readonly database: DatabaseService) {}

	async insert(sql: Executor, attempt: LoginAttempt, now: Date): Promise<void> {
		await sql`
			INSERT INTO login_attempt (id, attempted_at, device_id, user_id, method, outcome, reason, session_id)
			VALUES (
				${randomUUID()}, ${now}, ${attempt.deviceId}, ${attempt.userId}, ${attempt.method}, ${attempt.outcome},
				${attempt.reason}, ${attempt.sessionId}
			)
		`
	}

	async failuresSinceLastSuccess(
		userId: string,
		deviceId: string,
		methods: readonly LoginMethod[],
	): Promise<FailureState> {
		const [row] = await this.database.sql<FailureRow[]>`
			SELECT count(*)::int AS count, max(attempted_at) AS last_failed_at FROM login_attempt
			WHERE user_id = ${userId} AND device_id = ${deviceId} AND outcome = ${AUDIT_OUTCOME.FAILURE}
				AND method = ANY(${[...methods]})
				AND attempted_at > COALESCE(
					(SELECT max(attempted_at) FROM login_attempt WHERE user_id = ${userId} AND device_id = ${deviceId} AND outcome = ${AUDIT_OUTCOME.SUCCESS}),
					'-infinity'::timestamptz
				)
		`
		return { consecutiveFailures: row?.count ?? 0, lastFailedAt: row?.last_failed_at ?? undefined }
	}
}
