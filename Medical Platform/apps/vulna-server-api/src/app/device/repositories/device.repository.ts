import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { Device, DeviceRow, NewDevice } from "../types/device.types"

const DEVICE_COLUMNS = ["id", "state", "public_key_jwk", "hw_id", "group_code", "login_methods"] as const

@Injectable()
export class DeviceRepository {
	constructor(private readonly database: DatabaseService) {}

	async findByHwId(hwId: string): Promise<Device | undefined> {
		const [row] = await this.database.sql<DeviceRow[]>`
			SELECT ${this.database.sql(DEVICE_COLUMNS)} FROM device WHERE hw_id = ${hwId}
		`
		return row === undefined ? undefined : device(row)
	}

	async findById(id: string): Promise<Device | undefined> {
		const [row] = await this.database.sql<DeviceRow[]>`
			SELECT ${this.database.sql(DEVICE_COLUMNS)} FROM device WHERE id = ${id}
		`
		return row === undefined ? undefined : device(row)
	}

	async insert(tx: postgres.TransactionSql, next: NewDevice): Promise<Device> {
		const [row] = await tx<DeviceRow[]>`
			INSERT INTO device (
				id, state, public_key_jwk, hw_id, model, os_version, platform, secure_hardware,
				managed_configuration, group_code, blocked_predecessor_hw_id
			) VALUES (
				${randomUUID()}, ${next.state}, ${JSON.stringify(next.publicKeyJwk)}::text::jsonb, ${next.hwId},
				${next.model}, ${next.osVersion}, ${next.platform}, ${next.secureHardware},
				${next.managedConfiguration}, ${next.groupCode}, ${next.blockedPredecessorHwId}
			)
			RETURNING ${tx(DEVICE_COLUMNS)}
		`
		if (row === undefined) {
			throw new Error("inserting a device returned no row")
		}
		return device(row)
	}

	async issueToken(deviceId: string, tokenHash: string, expiresAt: Date): Promise<void> {
		await this.database.sql`
			INSERT INTO session (id, user_id, device_id, token_hash, expires_at)
			VALUES (${randomUUID()}, ${null}, ${deviceId}, ${tokenHash}, ${expiresAt})
		`
	}

	// CAP-002-R09, CAP-002-R08
	async findTokenDeviceId(tokenHash: string, now: Date): Promise<string | undefined> {
		const [row] = await this.database.sql<{ device_id: string }[]>`
			SELECT device_id FROM session
			WHERE token_hash = ${tokenHash} AND user_id IS NULL AND ended_at IS NULL AND expires_at > ${now}
		`
		return row?.device_id
	}

	async consumeProofIdentifier(deviceId: string, jti: string): Promise<boolean> {
		const rows = await this.database.sql`
			INSERT INTO dpop_jti (jti, device_id) VALUES (${jti}, ${deviceId})
			ON CONFLICT (jti) DO NOTHING
			RETURNING jti
		`
		return rows.length > 0
	}

	async forgetExpiredProofIdentifiers(before: Date): Promise<void> {
		await this.database.sql`DELETE FROM dpop_jti WHERE consumed_at < ${before}`
	}
}

function device(row: DeviceRow): Device {
	return {
		id: row.id,
		state: row.state,
		hwId: row.hw_id,
		publicKeyJwk: row.public_key_jwk,
		groupCode: row.group_code,
		loginMethods: row.login_methods,
	}
}
