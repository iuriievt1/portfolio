import { createHash } from "node:crypto"
import type { AuditOutcome } from "@ansora/contracts"
import { canonicalJson, type JsonObject } from "./canonical-json"

export const AUDIT_ACTOR_KIND = {
	USER: "user",
	DEVICE: "device",
	SYSTEM_JOB: "system_job",
} as const

export type AuditActorKind = (typeof AUDIT_ACTOR_KIND)[keyof typeof AUDIT_ACTOR_KIND]

export { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, type AuditEventType, type AuditOutcome } from "@ansora/contracts"

export const AUDIT_CHAIN_LOCK_NAME = "audit_chain"
export const FIRST_AUDIT_SEQUENCE = 1
export const NO_PREVIOUS_HASH = ""

export interface AuditTrailRecord {
	id: string
	sequence: number
	occurredAt: string
	eventType: string
	actorKind: AuditActorKind
	actorUserId: string | null
	actorDeviceId: string | null
	systemJob: string | null
	sessionId: string | null
	objectId: string | null
	sourceAddress: string | null
	outcome: AuditOutcome
	details: JsonObject
	previousHash: string
	hash: string
}

export type UnhashedAuditRecord = Omit<AuditTrailRecord, "hash">

// CAP-025-R04, CAP-025-R21
function recordDocument(record: UnhashedAuditRecord): JsonObject {
	const document: JsonObject = {
		id: record.id,
		sequence: record.sequence,
		occurred_at: record.occurredAt,
		event_type: record.eventType,
		actor_kind: record.actorKind,
		actor_user_id: record.actorUserId,
		actor_device_id: record.actorDeviceId,
		system_job: record.systemJob,
		session_id: record.sessionId,
		object_id: record.objectId,
		outcome: record.outcome,
		details: record.details,
		previous_hash: record.previousHash,
	}
	if (record.sourceAddress !== null) {
		document.source_address = record.sourceAddress
	}
	return document
}

export function auditRecordHash(record: UnhashedAuditRecord): string {
	return createHash("sha256")
		.update(canonicalJson(recordDocument(record)))
		.digest("hex")
}
