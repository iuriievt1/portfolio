import { AUDIT_ACTOR_KIND, AUDIT_CHAIN_LOCK_NAME, type AuditTrailRecord, auditRecordOf } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { AuditChainHeadRow, SystemJobAuditEvent } from "./audit.types"

// CAP-025-R14, CAP-025-R21, datovy-model.md 8
@Injectable()
export class AuditRepository {
	async appendSystemJob(tx: postgres.TransactionSql, event: SystemJobAuditEvent, now: Date): Promise<AuditTrailRecord> {
		await tx`SELECT pg_advisory_xact_lock(hashtext(${AUDIT_CHAIN_LOCK_NAME})::bigint)`
		const [head] = await tx<AuditChainHeadRow[]>`SELECT sequence, hash FROM audit ORDER BY sequence DESC LIMIT 1`
		const record = auditRecordOf(head, { ...event, actorKind: AUDIT_ACTOR_KIND.SYSTEM_JOB }, now)
		await tx`
			INSERT INTO audit (
				id, sequence, occurred_at, event_type, actor_kind, actor_user_id, actor_device_id,
				system_job, session_id, object_id, source_address, outcome, details, previous_hash, hash
			) VALUES (
				${record.id}, ${record.sequence}, ${record.occurredAt}::timestamptz, ${record.eventType}, ${record.actorKind},
				${record.actorUserId}, ${record.actorDeviceId}, ${record.systemJob}, ${record.sessionId}, ${record.objectId},
				${record.sourceAddress}, ${record.outcome}, ${JSON.stringify(record.details)}::text::jsonb,
				${record.previousHash}, ${record.hash}
			)
		`
		return record
	}
}
