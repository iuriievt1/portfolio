import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import type { OperatorPresenceRow } from "../types/draft-administration.types"

type Fragment = postgres.PendingQuery<postgres.Row[]>

// CAP-015-R19, datovy-model.md 4
function presenceColumns(sql: Executor): Fragment {
	return sql`
		operator.id AS user_id, operator.is_active,
		(SELECT max(login.created_at) FROM session login WHERE login.user_id = operator.id) AS last_login_at,
		EXISTS (
			SELECT 1 FROM session login
			WHERE login.user_id = operator.id AND login.ended_at IS NULL AND login.session_end > now()
		) AS has_active_session
	`
}

// CAP-015-R19, CAP-004-R14
@Injectable()
export class OperatorPresenceRepository {
	constructor(private readonly database: DatabaseService) {}

	async presenceOf(userIds: readonly string[]): Promise<OperatorPresenceRow[]> {
		if (userIds.length === 0) {
			return []
		}
		const sql = this.database.sql
		return await sql<OperatorPresenceRow[]>`
			SELECT ${presenceColumns(sql)} FROM app_user operator WHERE operator.id IN ${sql([...new Set(userIds)])}
		`
	}

	// CAP-015-S20
	async lockPresence(tx: postgres.TransactionSql, userId: string): Promise<OperatorPresenceRow | undefined> {
		const [row] = await tx<OperatorPresenceRow[]>`
			SELECT ${presenceColumns(tx)} FROM app_user operator WHERE operator.id = ${userId} FOR UPDATE OF operator
		`
		return row
	}
}
