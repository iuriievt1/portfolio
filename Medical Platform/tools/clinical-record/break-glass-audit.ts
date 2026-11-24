import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_CHAIN_LOCK_NAME, type AuditChainHead, auditRecordOf } from "@ansora/core-server"
import type postgres from "@veevoy/postgres"

export interface BreakGlassUse {
	operator: string
	reason: string
	sourceAddress: string
	succeeded: boolean
}

// CAP-012-S23, datovy-model.md 9
export async function recordBreakGlassUse(sql: postgres.Sql, use: BreakGlassUse): Promise<void> {
	await sql.begin(async (tx) => {
		await tx`SELECT pg_advisory_xact_lock(hashtext(${AUDIT_CHAIN_LOCK_NAME})::bigint)`
		const [head] = await tx<AuditChainHead[]>`SELECT sequence, hash FROM audit ORDER BY sequence DESC LIMIT 1`
		const record = auditRecordOf(
			head,
			{
				eventType: AUDIT_EVENT_TYPE.CLINICAL_RECORD_BREAK_GLASS_USE,
				actorKind: AUDIT_ACTOR_KIND.SYSTEM_JOB,
				systemJob: SYSTEM_JOB.CLINICAL_RECORD_INSTALLATION,
				sourceAddress: use.sourceAddress,
				outcome: use.succeeded ? AUDIT_OUTCOME.SUCCESS : AUDIT_OUTCOME.FAILURE,
				details: { operator: use.operator, reason: use.reason },
			},
			new Date(),
		)
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
	})
}
