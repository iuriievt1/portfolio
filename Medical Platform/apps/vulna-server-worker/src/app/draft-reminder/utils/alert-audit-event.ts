import { ADMINISTRATOR_ALERT_KIND, SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"

// CAP-028-R15, CAP-026-R16, datovy-model.md 8
export function staleDraftsAlertEventOf(alertId: string, message: string, staleCount: number): SystemJobAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
		systemJob: SYSTEM_JOB.DRAFT_REMINDER,
		objectId: alertId,
		outcome: AUDIT_OUTCOME.FAILURE,
		details: {
			alert_id: alertId,
			alert_kind: ADMINISTRATOR_ALERT_KIND.STALE_ACQUISITION_DRAFTS,
			message,
			stale_draft_count: staleCount,
		},
	}
}
