import type { AuditExportFailure } from "@ansora/contracts"
import type { AuditRecord } from "@ansora/core-server/ports"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { EXPORT_CURSOR_ID, EXPORT_LOCK_NAME } from "../constants/audit-export.constants"
import type { AuditRow } from "../types/audit-export.types"

function recordOf(row: AuditRow): AuditRecord {
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

// CAP-025-R09, datovy-model.md 8
@Injectable()
export class AuditExportRepository {
	async lock(tx: postgres.TransactionSql): Promise<boolean> {
		const [row] = await tx<{ locked: boolean }[]>`
			SELECT pg_try_advisory_xact_lock(hashtext(${EXPORT_LOCK_NAME})::bigint) AS locked
		`
		return row?.locked === true
	}

	async exportedSequence(tx: postgres.TransactionSql): Promise<number> {
		const [row] = await tx<{ exported_sequence: string }[]>`
			SELECT exported_sequence FROM audit_export_cursor WHERE id = ${EXPORT_CURSOR_ID}
		`
		if (row === undefined) {
			throw new Error("the audit export cursor is missing; the migration step creates it")
		}
		return Number(row.exported_sequence)
	}

	async recordsAfter(tx: postgres.TransactionSql, sequence: number, limit: number): Promise<AuditRecord[]> {
		const rows = await tx<AuditRow[]>`
			SELECT id, sequence, occurred_at, event_type, actor_kind, actor_user_id, actor_device_id, system_job,
				session_id, object_id, source_address, outcome, details, previous_hash, hash
			FROM audit
			WHERE sequence > ${sequence}
			ORDER BY sequence
			LIMIT ${limit}
		`
		return rows.map(recordOf)
	}

	async recordDelivery(tx: postgres.TransactionSql, sequence: number, at: Date): Promise<void> {
		await tx`
			UPDATE audit_export_cursor
			SET exported_sequence = ${sequence}, exported_at = ${at}, attempted_at = ${at}, failing_since = NULL,
				last_failure = NULL
			WHERE id = ${EXPORT_CURSOR_ID}
		`
	}

	async recordFailure(tx: postgres.TransactionSql, failure: AuditExportFailure, at: Date): Promise<void> {
		await tx`
			UPDATE audit_export_cursor
			SET attempted_at = ${at}, failing_since = COALESCE(failing_since, ${at}), last_failure = ${failure}
			WHERE id = ${EXPORT_CURSOR_ID}
		`
	}
}
