import type { AuditTrailRecord } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { containing } from "../../../libs/database/like-pattern"
import { EXPORT_CURSOR_ID } from "../constants/audit-administration.constants"
import type { AuditExportCursorRow, AuditExportRow, AuditFilter, AuditSearchRow } from "../types/audit.types"

const AUDIT_COLUMNS = `
	a.id, a.sequence, a.occurred_at, a.event_type, a.actor_kind, a.actor_user_id, a.actor_device_id, a.system_job,
	a.session_id, a.object_id, a.source_address, a.outcome, a.details, a.previous_hash, a.hash,
	u.personal_number, u.display_name
`

export function trailRecordOf(row: AuditSearchRow): AuditTrailRecord {
	return {
		id: row.id,
		sequence: Number(row.sequence),
		occurredAt: row.occurred_at.toISOString(),
		eventType: row.event_type,
		actorKind: row.actor_kind,
		actorUserId: row.actor_user_id,
		actorDeviceId: row.actor_device_id,
		systemJob: row.system_job,
		sessionId: row.session_id,
		objectId: row.object_id,
		sourceAddress: row.source_address,
		outcome: row.outcome,
		details: row.details,
		previousHash: row.previous_hash,
		hash: row.hash,
	}
}

export interface NewAuditExport {
	id: string
	requestedBy: string
	requestedAt: Date
	from: string | undefined
	to: string | undefined
	eventType: string | undefined
	untilSequence: number
}

// CAP-025-R07, CAP-025-R21, administrace-model-a-api.md 9
@Injectable()
export class AuditQueryRepository {
	constructor(private readonly database: DatabaseService) {}

	async page(filter: AuditFilter, limit: number, beforeSequence: number | undefined): Promise<AuditSearchRow[]> {
		const sql = this.database.sql
		const before = beforeSequence === undefined ? sql`TRUE` : sql`a.sequence < ${beforeSequence}`
		return await sql<AuditSearchRow[]>`
			SELECT ${sql.unsafe(AUDIT_COLUMNS)}
			FROM audit a
			LEFT JOIN app_user u ON u.id = a.actor_user_id
			LEFT JOIN device d ON d.id = a.actor_device_id
			WHERE ${this.matching(filter)} AND ${before}
			ORDER BY a.sequence DESC
			LIMIT ${limit}
		`
	}

	async inChainOrder(onBatch: (rows: AuditSearchRow[]) => Promise<boolean>, batch: number): Promise<void> {
		const sql = this.database.sql
		await sql<AuditSearchRow[]>`
			SELECT ${sql.unsafe(AUDIT_COLUMNS)}
			FROM audit a
			LEFT JOIN app_user u ON u.id = a.actor_user_id
			ORDER BY a.sequence
		`.cursor(batch, async (rows) => ((await onBatch(rows)) ? undefined : sql.CLOSE))
	}

	exported(row: AuditExportRow, batch: number): AsyncIterable<AuditSearchRow[]> {
		const sql = this.database.sql
		const filter: AuditFilter = {
			from: row.from_time?.toISOString(),
			to: row.to_time?.toISOString(),
			eventType: row.event_type ?? undefined,
		}
		return sql<AuditSearchRow[]>`
			SELECT ${sql.unsafe(AUDIT_COLUMNS)}
			FROM audit a
			LEFT JOIN app_user u ON u.id = a.actor_user_id
			LEFT JOIN device d ON d.id = a.actor_device_id
			WHERE ${this.matching(filter)} AND a.sequence <= ${row.until_sequence}
			ORDER BY a.sequence
		`.cursor(batch)
	}

	async latestSequence(executor: postgres.Sql | postgres.TransactionSql = this.database.sql): Promise<number> {
		const [row] = await executor<{ sequence: string | null }[]>`SELECT max(sequence) AS sequence FROM audit`
		return Number(row?.sequence ?? 0)
	}

	async insertExport(tx: postgres.TransactionSql, auditExport: NewAuditExport): Promise<void> {
		await tx`
			INSERT INTO audit_export (id, requested_by, requested_at, from_time, to_time, event_type, until_sequence)
			VALUES (
				${auditExport.id}, ${auditExport.requestedBy}, ${auditExport.requestedAt}, ${auditExport.from ?? null}::timestamptz,
				${auditExport.to ?? null}::timestamptz, ${auditExport.eventType ?? null}, ${auditExport.untilSequence}
			)
		`
	}

	async findExport(id: string): Promise<AuditExportRow | undefined> {
		const [row] = await this.database.sql<AuditExportRow[]>`
			SELECT id, requested_by, requested_at, from_time, to_time, event_type, until_sequence
			FROM audit_export WHERE id = ${id}
		`
		return row
	}

	async exportCursor(): Promise<AuditExportCursorRow | undefined> {
		const [row] = await this.database.sql<AuditExportCursorRow[]>`
			SELECT exported_sequence, exported_at, attempted_at, failing_since, last_failure
			FROM audit_export_cursor WHERE id = ${EXPORT_CURSOR_ID}
		`
		return row
	}

	private matching(filter: AuditFilter): postgres.PendingQuery<postgres.Row[]> {
		const sql = this.database.sql
		const conditions = [
			filter.from === undefined ? undefined : sql`a.occurred_at >= ${filter.from}::timestamptz`,
			filter.to === undefined ? undefined : sql`a.occurred_at <= ${filter.to}::timestamptz`,
			filter.user === undefined
				? undefined
				: sql`(u.personal_number = ${filter.user} OR u.display_name ILIKE ${containing(filter.user)}
					OR a.actor_user_id::text = ${filter.user})`,
			filter.systemJob === undefined ? undefined : sql`a.system_job = ${filter.systemJob}`,
			filter.device === undefined
				? undefined
				: sql`(a.actor_device_id::text = ${filter.device} OR d.hw_id = ${filter.device})`,
			filter.eventType === undefined ? undefined : sql`a.event_type = ${filter.eventType}`,
			filter.patientIdentifier === undefined
				? undefined
				: sql`(a.details->>'patient_identifier' = ${filter.patientIdentifier}
					OR a.details->'patient_identifiers' @> jsonb_build_array(${filter.patientIdentifier}::text))`,
			filter.outcome === undefined
				? undefined
				: sql`(a.outcome = ${filter.outcome} OR a.details->>'outcome' = ${filter.outcome})`,
		].filter((condition) => condition !== undefined)
		return conditions.reduce((all, condition) => sql`${all} AND ${condition}`, sql`TRUE`)
	}
}
