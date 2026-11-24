import type { AuditExportFailure, SystemJob } from "@ansora/contracts"
import type { AuditActorKind, AuditChainHead, AuditEventInput, AuditOutcome, JsonObject } from "@ansora/core-server"

export type NewAuditEvent = Omit<AuditEventInput, "sourceAddress">

export type UserAuditEvent = Pick<NewAuditEvent, "eventType" | "objectId" | "outcome" | "details">

export type AuditActor = (event: UserAuditEvent) => NewAuditEvent

export type AuditChainHeadRow = AuditChainHead

export interface AuditSearchRow {
	id: string
	sequence: string
	occurred_at: Date
	event_type: string
	actor_kind: AuditActorKind
	actor_user_id: string | null
	actor_device_id: string | null
	system_job: string | null
	session_id: string | null
	object_id: string | null
	source_address: string | null
	outcome: AuditOutcome
	details: JsonObject
	previous_hash: string
	hash: string
	personal_number: string | null
	display_name: string | null
}

export interface AuditFilter {
	from?: string
	to?: string
	user?: string
	systemJob?: SystemJob
	device?: string
	eventType?: string
	patientIdentifier?: string
	outcome?: string
}

export interface AuditExportRow {
	id: string
	requested_by: string
	requested_at: Date
	from_time: Date | null
	to_time: Date | null
	event_type: string | null
	until_sequence: string
}

export interface AuditExportCursorRow {
	exported_sequence: string
	exported_at: Date | null
	attempted_at: Date | null
	failing_since: Date | null
	last_failure: AuditExportFailure | null
}

// CAP-025-R21
export interface BrokenAuditRecord {
	id: string
	occurredAt: string
}
