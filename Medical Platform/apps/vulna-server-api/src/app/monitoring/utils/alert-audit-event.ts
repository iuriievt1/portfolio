import type { SystemJob } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME, type JsonObject } from "@ansora/core-server"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { RaisedAlert } from "../types/monitoring.types"

// CAP-028-R15, datovy-model.md 8
export function alertRaisedDetailsOf(alert: RaisedAlert): JsonObject {
	return { alert_id: alert.alertId, alert_kind: alert.kind, message: alert.message, ...alert.subject }
}

export function alertRaisedEventOf(alert: RaisedAlert, systemJob: SystemJob): NewAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
		actorKind: AUDIT_ACTOR_KIND.SYSTEM_JOB,
		systemJob,
		objectId: alert.alertId,
		outcome: AUDIT_OUTCOME.FAILURE,
		details: alertRaisedDetailsOf(alert),
	}
}
