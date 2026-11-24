import { randomUUID } from "node:crypto"
import { SESSION_END_REASON, type SessionEndReason } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import type { NewUserSession, UserSession, UserSessionRow } from "../types/login.types"

const SESSION_COLUMNS = ["id", "user_id", "device_id", "expires_at", "created_at", "session_end", "ended_at"] as const

@Injectable()
export class SessionRepository {
	constructor(private readonly database: DatabaseService) {}

	async findByTokenHash(tokenHash: string): Promise<UserSession | undefined> {
		const [row] = await this.database.sql<UserSessionRow[]>`
			SELECT ${this.database.sql(SESSION_COLUMNS)} FROM session
			WHERE token_hash = ${tokenHash} AND user_id IS NOT NULL
		`
		return row === undefined ? undefined : session(row)
	}

	async findById(sql: Executor, id: string): Promise<UserSession | undefined> {
		const [row] = await sql<UserSessionRow[]>`
			SELECT ${sql(SESSION_COLUMNS)} FROM session WHERE id = ${id} AND user_id IS NOT NULL
		`
		return row === undefined ? undefined : session(row)
	}

	async activeOnDevice(sql: Executor, deviceId: string, now: Date): Promise<UserSession | undefined> {
		const [row] = await sql<UserSessionRow[]>`
			SELECT ${sql(SESSION_COLUMNS)} FROM session
			WHERE device_id = ${deviceId} AND user_id IS NOT NULL AND ended_at IS NULL
		`
		if (row === undefined) {
			return undefined
		}
		if (row.session_end.getTime() <= now.getTime()) {
			await this.end(sql, row.id, SESSION_END_REASON.EXPIRED, now)
			return undefined
		}
		return session(row)
	}

	async activeOfUser(sql: Executor, userId: string, now: Date): Promise<UserSession[]> {
		const rows = await sql<UserSessionRow[]>`
			SELECT ${sql(SESSION_COLUMNS)} FROM session
			WHERE user_id = ${userId} AND ended_at IS NULL AND session_end > ${now}
		`
		return rows.map(session)
	}

	async insert(sql: Executor, next: NewUserSession): Promise<UserSession> {
		const [row] = await sql<UserSessionRow[]>`
			INSERT INTO session (id, user_id, device_id, token_hash, expires_at, created_at, session_end, token_issued_at)
			VALUES (
				${randomUUID()}, ${next.userId}, ${next.deviceId}, ${next.tokenHash}, ${next.tokenExpiresAt},
				${next.startedAt}, ${next.sessionEnd}, ${next.startedAt}
			)
			RETURNING ${sql(SESSION_COLUMNS)}
		`
		if (row === undefined) {
			throw new Error("inserting a session returned no row")
		}
		return session(row)
	}

	async rotateToken(sql: Executor, id: string, tokenHash: string, tokenExpiresAt: Date, now: Date): Promise<void> {
		await sql`
			UPDATE session SET token_hash = ${tokenHash}, expires_at = ${tokenExpiresAt}, token_issued_at = ${now}
			WHERE id = ${id}
		`
	}

	async end(sql: Executor, id: string, reason: SessionEndReason, now: Date): Promise<void> {
		await sql`UPDATE session SET ended_at = ${now}, end_reason = ${reason} WHERE id = ${id} AND ended_at IS NULL`
	}
}

function session(row: UserSessionRow): UserSession {
	return {
		id: row.id,
		userId: row.user_id,
		deviceId: row.device_id,
		tokenExpiresAt: row.expires_at,
		startedAt: row.created_at,
		sessionEnd: row.session_end,
		endedAt: row.ended_at,
	}
}
