import type { PinPublicKeyJwk, UserDeviceCredential } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import type { UserDeviceCredentialRow } from "../types/login.types"

const COLUMNS = ["pin_public_key", "blocked_at", "last_full_login_at"] as const

@Injectable()
export class UserDeviceCredentialRepository {
	constructor(private readonly database: DatabaseService) {}

	async find(
		userId: string,
		deviceId: string,
		sql: Executor = this.database.sql,
	): Promise<UserDeviceCredential | undefined> {
		const [row] = await sql<UserDeviceCredentialRow[]>`
			SELECT ${sql(COLUMNS)} FROM user_device_credential WHERE user_id = ${userId} AND device_id = ${deviceId}
		`
		return row === undefined ? undefined : credential(row)
	}

	async recordFullLogin(
		sql: Executor,
		userId: string,
		deviceId: string,
		now: Date,
		pinPublicKey: PinPublicKeyJwk | undefined,
	): Promise<void> {
		const key = pinPublicKey === undefined ? null : JSON.stringify(pinPublicKey)
		await sql`
			INSERT INTO user_device_credential (user_id, device_id, pin_public_key, pin_set_at, blocked_at, last_full_login_at)
			VALUES (${userId}, ${deviceId}, ${key}::text::jsonb, ${pinPublicKey === undefined ? null : now}, NULL, ${now})
			ON CONFLICT (user_id, device_id) DO UPDATE SET
				pin_public_key = COALESCE(EXCLUDED.pin_public_key, user_device_credential.pin_public_key),
				pin_set_at = COALESCE(EXCLUDED.pin_set_at, user_device_credential.pin_set_at),
				blocked_at = NULL,
				last_full_login_at = EXCLUDED.last_full_login_at
		`
	}

	async block(sql: Executor, userId: string, deviceId: string, now: Date): Promise<void> {
		await sql`
			INSERT INTO user_device_credential (user_id, device_id, blocked_at)
			VALUES (${userId}, ${deviceId}, ${now})
			ON CONFLICT (user_id, device_id) DO UPDATE SET blocked_at = EXCLUDED.blocked_at
		`
	}
}

function credential(row: UserDeviceCredentialRow): UserDeviceCredential {
	return {
		pinPublicKey: row.pin_public_key,
		blockedAt: row.blocked_at,
		lastFullLoginAt: row.last_full_login_at,
	}
}
