import { ADMINISTRATOR_ALERT_KIND, SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import type { SetAsideObjectRow } from "../types/orphan-cleanup.types"

// CAP-026-R14, CAP-026-S07, datovy-model.md 8
export function orphanSetAsideEventOf(object: SetAsideObjectRow): SystemJobAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.ORPHANED_OBJECT_SET_ASIDE,
		systemJob: SYSTEM_JOB.ORPHAN_CLEANUP,
		objectId: object.id,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			binary_object_id: object.id,
			size_bytes: Number(object.size_bytes),
			created_at: object.created_at.toISOString(),
		},
	}
}

// CAP-028-R15, CAP-026-R14, datovy-model.md 8
export function orphanAlertEventOf(alertId: string, message: string, setAsideCount: number): SystemJobAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
		systemJob: SYSTEM_JOB.ORPHAN_CLEANUP,
		objectId: alertId,
		outcome: AUDIT_OUTCOME.FAILURE,
		details: {
			alert_id: alertId,
			alert_kind: ADMINISTRATOR_ALERT_KIND.ORPHANED_OBJECTS_SET_ASIDE,
			message,
			set_aside_object_count: setAsideCount,
		},
	}
}
