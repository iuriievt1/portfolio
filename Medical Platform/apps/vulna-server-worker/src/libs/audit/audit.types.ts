import type { SystemJob } from "@ansora/contracts"
import type { AuditChainHead, AuditEventType, AuditOutcome, JsonObject } from "@ansora/core-server"

export interface SystemJobAuditEvent {
	eventType: AuditEventType
	systemJob: SystemJob
	objectId: string | undefined
	outcome: AuditOutcome
	details: JsonObject
}

export type AuditChainHeadRow = AuditChainHead
