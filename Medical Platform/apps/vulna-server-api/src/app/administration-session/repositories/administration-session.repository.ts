import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import type { AdministrationSessionEndReason } from "../constants/administration-session.constants"
import type { AdministrationSessionRow, NewAdministrationSession } from "../types/administration-session.types"

@Injectable()
export class AdministrationSessionRepository {
	constructor(private readonly database: DatabaseService) {}

	async insert(sql: Executor, next: NewAdministrationSession): Promise<string> {
		const id = randomUUID()
		await sql`
			INSERT INTO administration_session (id, user_id, token_hash, created_at, last_activity_at, confirmed_at, expires_at)
			VALUES (
				${id}, ${next.userId}, ${next.tokenHash}, ${next.createdAt}, ${next.createdAt}, ${next.createdAt}, ${next.expiresAt}
			)
		`
		return id
	}

	async findByTokenHash(tokenHash: string): Promise<AdministrationSessionRow | undefined> {
		return await this.findOne(this.database.sql`s.token_hash = ${tokenHash}`)
	}

	async findById(id: string): Promise<AdministrationSessionRow | undefined> {
		return await this.findOne(this.database.sql`s.id = ${id}`)
	}

	async touch(id: string, now: Date): Promise<void> {
		await this.database.sql`UPDATE administration_session SET last_activity_at = ${now} WHERE id = ${id}`
	}

	async confirm(id: string, now: Date): Promise<void> {
		await this.database.sql`UPDATE administration_session SET confirmed_at = ${now} WHERE id = ${id}`
	}

	async end(sql: Executor, id: string, reason: AdministrationSessionEndReason, now: Date): Promise<boolean> {
		const rows = await sql`
			UPDATE administration_session SET ended_at = ${now}, end_reason = ${reason}
			WHERE id = ${id} AND ended_at IS NULL
			RETURNING id
		`
		return rows.length > 0
	}

	async endAllOf(sql: Executor, userId: string, reason: AdministrationSessionEndReason, now: Date): Promise<string[]> {
		const rows = await sql<{ id: string }[]>`
			UPDATE administration_session SET ended_at = ${now}, end_reason = ${reason}
			WHERE user_id = ${userId} AND ended_at IS NULL AND expires_at > ${now}
			RETURNING id
		`
		return rows.map((row) => row.id)
	}

	private async findOne(
		condition: postgres.PendingQuery<postgres.Row[]>,
	): Promise<AdministrationSessionRow | undefined> {
		const [row] = await this.database.sql<AdministrationSessionRow[]>`
			SELECT s.id, s.user_id, s.last_activity_at, s.confirmed_at, s.expires_at, s.ended_at, u.is_active
			FROM administration_session s JOIN app_user u ON u.id = s.user_id
			WHERE ${condition}
		`
		return row
	}
}
