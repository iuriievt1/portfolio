import type { AuditActorKind, AuditOutcome, JsonObject } from "@ansora/core-server"
import type { AuditSinkPort } from "@ansora/core-server/ports"
import type { SyslogSettings } from "@ansora/vulna-adapter-syslog"

export interface AuditRow {
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
}

export type AuditSinkFactory = (settings: SyslogSettings) => AuditSinkPort
