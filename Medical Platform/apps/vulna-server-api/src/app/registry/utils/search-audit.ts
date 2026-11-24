import type { AuditSearchMethod } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, type JsonObject } from "@ansora/core-server"
import type { UserAuditEvent } from "../../audit/types/audit.types"
import type { FoundPatient } from "../types/registry.types"
import { auditSubjectOf } from "./patient-view"

// CAP-025-R18, CAP-025-S17
export function searchAuditDetailsOf(
	method: AuditSearchMethod,
	released: readonly FoundPatient[],
	releasedItemCount: number | undefined,
): JsonObject {
	const subjects = released.flatMap((found) => {
		const subject = auditSubjectOf(found)
		return subject === undefined ? [] : [subject]
	})
	const details: JsonObject = { search_method: method }
	if (subjects.length === 1) {
		details.patient_identifier = subjects[0] ?? null
	} else if (subjects.length > 1) {
		details.patient_identifiers = subjects
	}
	if (releasedItemCount !== undefined) {
		details.released_item_count = releasedItemCount
	}
	return details
}

// CAP-025-R18
export function patientListEventOf(
	method: AuditSearchMethod,
	released: readonly FoundPatient[],
	releasedItemCount: number,
): UserAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.PATIENT_SEARCH,
		outcome: releasedItemCount > 0 ? AUDIT_OUTCOME.MATCH : AUDIT_OUTCOME.NO_MATCH,
		details: searchAuditDetailsOf(method, released, releasedItemCount),
	}
}
