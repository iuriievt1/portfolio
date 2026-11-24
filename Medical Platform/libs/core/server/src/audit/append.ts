import { randomUUID } from "node:crypto"
import type { AuditEventType, AuditOutcome, SystemJob } from "@ansora/contracts"
import type { JsonObject } from "./canonical-json"
import {
	type AuditActorKind,
	type AuditTrailRecord,
	auditRecordHash,
	FIRST_AUDIT_SEQUENCE,
	NO_PREVIOUS_HASH,
	type UnhashedAuditRecord,
} from "./record"

export interface AuditEventInput {
	eventType: AuditEventType
	actorKind: AuditActorKind
	actorUserId?: string
	actorDeviceId?: string
	systemJob?: SystemJob
	sessionId?: string
	objectId?: string
	sourceAddress?: string
	outcome: AuditOutcome
	details: JsonObject
}

export interface AuditChainHead {
	sequence: string
	hash: string
}

// CAP-025-R04, CAP-025-R21
export function auditRecordOf(head: AuditChainHead | undefined, event: AuditEventInput, now: Date): AuditTrailRecord {
	const unhashed: UnhashedAuditRecord = {
		id: randomUUID(),
		sequence: head === undefined ? FIRST_AUDIT_SEQUENCE : Number(head.sequence) + 1,
		occurredAt: now.toISOString(),
		eventType: event.eventType,
		actorKind: event.actorKind,
		actorUserId: event.actorUserId ?? null,
		actorDeviceId: event.actorDeviceId ?? null,
		systemJob: event.systemJob ?? null,
		sessionId: event.sessionId ?? null,
		objectId: event.objectId ?? null,
		sourceAddress: event.sourceAddress ?? null,
		outcome: event.outcome,
		details: event.details,
		previousHash: head?.hash ?? NO_PREVIOUS_HASH,
	}
	return { ...unhashed, hash: auditRecordHash(unhashed) }
}
