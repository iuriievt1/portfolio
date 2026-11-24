import { AUDIT_CHAIN_LOCK_NAME, type AuditTrailRecord, auditRecordOf } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { requestSourceAddress } from "../../infra/request-context/request-context"
import type { AuditChainHeadRow, NewAuditEvent } from "../types/audit.types"

@Injectable()
export class AuditRepository {
	async append(tx: postgres.TransactionSql, event: NewAuditEvent): Promise<AuditTrailRecord> {
		await tx`SELECT pg_advisory_xact_lock(hashtext(${AUDIT_CHAIN_LOCK_NAME})::bigint)`
		const [head] = await tx<AuditChainHeadRow[]>`SELECT sequence, hash FROM audit ORDER BY sequence DESC LIMIT 1`
		const record = auditRecordOf(head, { ...event, sourceAddress: requestSourceAddress() }, new Date())
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
