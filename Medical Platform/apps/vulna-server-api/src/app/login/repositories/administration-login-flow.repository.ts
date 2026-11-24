import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationLoginFlowRow, NewAdministrationLoginFlow } from "../types/administration-login.types"

@Injectable()
export class AdministrationLoginFlowRepository {
	constructor(private readonly database: DatabaseService) {}

	async insert(flow: NewAdministrationLoginFlow): Promise<void> {
		await this.database.sql`
			INSERT INTO administration_login_flow (state, code_verifier, nonce, started_at, expires_at)
			VALUES (${flow.state}, ${flow.codeVerifier}, ${flow.nonce}, ${flow.startedAt}, ${flow.expiresAt})
		`
	}

	// single use
	async take(state: string, now: Date): Promise<AdministrationLoginFlowRow | undefined> {
		const [row] = await this.database.sql<AdministrationLoginFlowRow[]>`
			UPDATE administration_login_flow SET consumed_at = ${now}
			WHERE state = ${state} AND consumed_at IS NULL AND expires_at > ${now}
			RETURNING code_verifier, nonce, started_at
		`
		return row
	}

	async deleteExpired(before: Date): Promise<void> {
		await this.database.sql`DELETE FROM administration_login_flow WHERE expires_at < ${before}`
	}
}
