import type { IssuedChallenge } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import type { LoginChallengeRow } from "../types/login.types"

@Injectable()
export class LoginChallengeRepository {
	constructor(private readonly database: DatabaseService) {}

	async insert(deviceId: string, challenge: IssuedChallenge, confirmedUserId: string | null): Promise<void> {
		await this.database.sql`
			INSERT INTO login_challenge (id, device_id, value_hash, expires_at, confirmed_user_id)
			VALUES (${challenge.id}, ${deviceId}, ${challenge.valueHash}, ${challenge.expiresAt}, ${confirmedUserId})
		`
	}

	async consume(id: string, deviceId: string, now: Date): Promise<LoginChallengeRow | undefined> {
		const [row] = await this.database.sql<LoginChallengeRow[]>`
			UPDATE login_challenge SET consumed_at = ${now}
			WHERE id = ${id} AND device_id = ${deviceId} AND consumed_at IS NULL AND expires_at > ${now}
			RETURNING value_hash, confirmed_user_id
		`
		return row
	}

	async deleteExpired(before: Date): Promise<void> {
		await this.database.sql`DELETE FROM login_challenge WHERE expires_at < ${before}`
	}
}
