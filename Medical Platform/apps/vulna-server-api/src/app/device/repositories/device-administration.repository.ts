import { randomUUID } from "node:crypto"
import {
	DEVICE_STATE,
	type DeviceState,
	type ExplicitOverrides,
	type LoginMethodOverrides,
	SESSION_END_REASON,
} from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { isUniqueViolation } from "../../../libs/database/unique-violation"
import { cursorMomentOf, decodeMomentCursor, olderThan } from "../../infra/utils/cursor-moment"
import { encodePageCursor } from "../../infra/utils/page-cursor"
import { DeviceGroupCodeTakenError } from "../errors/device-group-code-taken.error"
import type {
	DeviceBlocking,
	DeviceDetailRow,
	DeviceGroupRow,
	DeviceOverridesRow,
	DevicePage,
	DevicePageQuery,
	DevicePageRow,
	DeviceUnblocking,
	EndedSessionRow,
	NewDeviceGroup,
} from "../types/device-administration.types"

const DEVICE_COLUMNS = `
	id, state, public_key_jwk, hw_id, model, os_version, platform, managed_configuration,
	group_code, blocked_predecessor_hw_id, last_contact_at, login_methods, registered_at,
	queue_waiting_count, queue_failed_count, queue_oldest_acquired_at, queue_detected_at, queue_reported_at,
	blocking_detected_at, blocking_signals, blocking_app_version, unblocked_at, unblocked_by_user_id, unblock_reason,
	predecessor_id, predecessor_blocking_detected_at, predecessor_blocking_signals, predecessor_blocking_app_version
`

// CAP-006-R19, CAP-008-R12, administration.yaml Device.blocked_predecessor
const DEVICE_WITH_PREDECESSOR = `
	device LEFT JOIN LATERAL (
		SELECT
			predecessor.id AS predecessor_id,
			predecessor.blocking_detected_at AS predecessor_blocking_detected_at,
			predecessor.blocking_signals AS predecessor_blocking_signals,
			predecessor.blocking_app_version AS predecessor_blocking_app_version
		FROM device predecessor
		WHERE predecessor.hw_id = device.blocked_predecessor_hw_id AND predecessor.id <> device.id
	) AS blocked_predecessor ON TRUE
`

const GROUP_COLUMNS = `
	g.id, g.code, g.name, g.login_methods,
	(SELECT count(*) FROM device d WHERE d.group_code = g.code) AS device_count
`

@Injectable()
export class DeviceAdministrationRepository {
	constructor(private readonly database: DatabaseService) {}

	async page(query: DevicePageQuery): Promise<DevicePage> {
		const sql = this.database.sql
		const byState = query.state === undefined ? sql`TRUE` : sql`state = ${query.state}`
		const rows = await sql<DevicePageRow[]>`
			SELECT ${sql.unsafe(DEVICE_COLUMNS)}, ${cursorMomentOf(sql, sql`registered_at`)} AS cursor_moment
			FROM ${sql.unsafe(DEVICE_WITH_PREDECESSOR)}
			WHERE ${byState} AND ${olderThan(sql, sql`registered_at, id`, decodeMomentCursor(query.cursor))}
			ORDER BY registered_at DESC, id DESC
			LIMIT ${query.limit + 1}
		`
		return { rows: rows.slice(0, query.limit), hasMore: rows.length > query.limit }
	}

	async find(id: string): Promise<DeviceDetailRow | undefined> {
		const sql = this.database.sql
		const [row] = await sql<DeviceDetailRow[]>`
			SELECT ${sql.unsafe(DEVICE_COLUMNS)} FROM ${sql.unsafe(DEVICE_WITH_PREDECESSOR)} WHERE id = ${id}
		`
		return row
	}

	// CAP-006-R20, CAP-007-R08
	async lockState(tx: postgres.TransactionSql, id: string): Promise<DeviceState | undefined> {
		const [row] = await tx<{ state: DeviceState }[]>`SELECT state FROM device WHERE id = ${id} FOR UPDATE`
		return row?.state
	}

	// CAP-002-R08, CAP-002-R10
	async endSessionsOf(tx: postgres.TransactionSql, deviceId: string, now: Date): Promise<EndedSessionRow[]> {
		return await tx<EndedSessionRow[]>`
			UPDATE session SET ended_at = ${now}, end_reason = ${SESSION_END_REASON.DEVICE_REVOKED}
			WHERE device_id = ${deviceId} AND ended_at IS NULL
			RETURNING id, user_id
		`
	}

	async changeState(tx: postgres.TransactionSql, id: string, state: DeviceState): Promise<void> {
		await tx`UPDATE device SET state = ${state} WHERE id = ${id}`
	}

	// CAP-008-R05, CAP-008-R12
	async block(tx: postgres.TransactionSql, id: string, blocking: DeviceBlocking): Promise<void> {
		await tx`
			UPDATE device SET
				state = ${DEVICE_STATE.BLOCKED},
				blocking_detected_at = ${blocking.detectedAt}::timestamptz,
				blocking_signals = ${[...blocking.signals]}::text[],
				blocking_app_version = ${blocking.appVersion}
			WHERE id = ${id}
		`
	}

	// CAP-007-R06, CAP-007-S07
	async unblock(tx: postgres.TransactionSql, id: string, unblocking: DeviceUnblocking): Promise<boolean> {
		const rows = await tx`
			UPDATE device SET
				unblocked_at = ${unblocking.unblockedAt},
				unblocked_by_user_id = ${unblocking.administratorUserId},
				unblock_reason = ${unblocking.reason}
			WHERE id = ${id} AND unblocked_at IS NULL
			RETURNING id
		`
		return rows.length > 0
	}

	async assignGroup(tx: postgres.TransactionSql, id: string, groupCode: string): Promise<void> {
		await tx`UPDATE device SET group_code = ${groupCode} WHERE id = ${id}`
	}

	async groups(): Promise<DeviceGroupRow[]> {
		const sql = this.database.sql
		return await sql<DeviceGroupRow[]>`SELECT ${sql.unsafe(GROUP_COLUMNS)} FROM device_group g ORDER BY g.code`
	}

	async findGroup(id: string): Promise<DeviceGroupRow | undefined> {
		const sql = this.database.sql
		const [row] = await sql<
			DeviceGroupRow[]
		>`SELECT ${sql.unsafe(GROUP_COLUMNS)} FROM device_group g WHERE g.id = ${id}`
		return row
	}

	async groupLoginMethods(): Promise<Map<string, LoginMethodOverrides>> {
		const rows = await this.database.sql<{ code: string; login_methods: LoginMethodOverrides }[]>`
			SELECT code, login_methods FROM device_group
		`
		return new Map(rows.map((row) => [row.code, row.login_methods]))
	}

	async insertGroup(tx: postgres.TransactionSql, group: NewDeviceGroup): Promise<string> {
		try {
			const [row] = await tx<{ id: string }[]>`
				INSERT INTO device_group (id, code, name, login_methods)
				VALUES (${randomUUID()}, ${group.code}, ${group.name}, ${JSON.stringify(group.loginMethods)}::text::jsonb)
				RETURNING id
			`
			if (row === undefined) {
				throw new Error(`inserting device group ${group.code} returned no row`)
			}
			return row.id
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new DeviceGroupCodeTakenError(group.code)
			}
			throw error
		}
	}

	async renameGroup(tx: postgres.TransactionSql, id: string, name: string): Promise<void> {
		await tx`UPDATE device_group SET name = ${name} WHERE id = ${id}`
	}

	async setDeviceLoginMethods(tx: postgres.TransactionSql, id: string, overrides: ExplicitOverrides): Promise<void> {
		await tx`UPDATE device SET login_methods = ${JSON.stringify(overrides)}::text::jsonb WHERE id = ${id}`
	}

	async setGroupLoginMethods(tx: postgres.TransactionSql, id: string, overrides: ExplicitOverrides): Promise<void> {
		await tx`UPDATE device_group SET login_methods = ${JSON.stringify(overrides)}::text::jsonb WHERE id = ${id}`
	}

	async devicesWithOverrides(tx: postgres.TransactionSql, groupCode: string): Promise<DeviceOverridesRow[]> {
		return await tx<DeviceOverridesRow[]>`
			SELECT id, hw_id, login_methods FROM device
			WHERE group_code = ${groupCode} AND jsonb_path_exists(login_methods, '$.* ? (@.type() == "boolean")')
		`
	}

	async clearDeviceOverrides(tx: postgres.TransactionSql, groupCode: string): Promise<void> {
		await tx`UPDATE device SET login_methods = '{}'::jsonb WHERE group_code = ${groupCode}`
	}
}

// ADR-012
export function encodeCursor(row: DevicePageRow): string {
	return encodePageCursor({ sortKey: row.cursor_moment, id: row.id })
}
