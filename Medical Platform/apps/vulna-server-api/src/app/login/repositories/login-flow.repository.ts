import { Injectable } from "@nestjs/common"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import type { LoginFlowReturn, LoginFlowRow, NewLoginFlow } from "../types/login.types"

const FLOW_COLUMNS = [
	"state",
	"device_id",
	"device_key_thumbprint",
	"code_verifier",
	"nonce",
	"expected_personal_number",
	"started_at",
	"expires_at",
	"returned_at",
	"outcome",
	"completion_code_hash",
	"completion_expires_at",
	"consumed_at",
] as const

@Injectable()
export class LoginFlowRepository {
	constructor(private readonly database: DatabaseService) {}

	async insert(flow: NewLoginFlow): Promise<void> {
		await this.database.sql`
			INSERT INTO oidc_login_flow (
				state, device_id, device_key_thumbprint, code_verifier, nonce, expected_personal_number, started_at, expires_at
			) VALUES (
				${flow.state}, ${flow.deviceId}, ${flow.deviceKeyThumbprint}, ${flow.codeVerifier}, ${flow.nonce},
				${flow.expectedPersonalNumber}, ${flow.startedAt}, ${flow.expiresAt}
			)
		`
	}

	async findByState(state: string): Promise<LoginFlowRow | undefined> {
		const [row] = await this.database.sql<LoginFlowRow[]>`
			SELECT ${this.database.sql(FLOW_COLUMNS)} FROM oidc_login_flow WHERE state = ${state}
		`
		return row
	}

	async recordReturn(state: string, flowReturn: LoginFlowReturn): Promise<boolean> {
		const rows = await this.database.sql`
			UPDATE oidc_login_flow SET
				returned_at = ${flowReturn.returnedAt},
				outcome = ${JSON.stringify(flowReturn.outcome)}::text::jsonb,
				completion_code_hash = ${flowReturn.completionCodeHash},
				completion_expires_at = ${flowReturn.completionExpiresAt}
			WHERE state = ${state} AND returned_at IS NULL
			RETURNING state
		`
		return rows.length > 0
	}

	async consume(sql: Executor, state: string, now: Date): Promise<boolean> {
		const rows = await sql`
			UPDATE oidc_login_flow SET consumed_at = ${now} WHERE state = ${state} AND consumed_at IS NULL RETURNING state
		`
		return rows.length > 0
	}

	async deleteExpired(before: Date): Promise<void> {
		await this.database.sql`DELETE FROM oidc_login_flow WHERE expires_at < ${before}`
	}
}
