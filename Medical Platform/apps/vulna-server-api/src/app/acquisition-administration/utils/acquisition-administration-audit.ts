import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import type { UserAuditEvent } from "../../audit/types/audit.types"
import type { FoundPatient } from "../../registry/types/registry.types"
import { auditSubjectOf } from "../../registry/utils/patient-view"

// CAP-004-R10, CAP-025-R03, datovy-model.md 8
export function acquisitionsViewedEventOf(patients: readonly FoundPatient[]): UserAuditEvent {
	const subjects = patients.flatMap((patient) => auditSubjectOf(patient) ?? [])
	return {
		eventType: AUDIT_EVENT_TYPE.ACQUISITIONS_VIEWED,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			released_item_count: patients.length,
			patient_identifiers: [...new Set(subjects)],
		},
	}
}
