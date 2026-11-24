import type { JsonObject } from "@ansora/core-server"
import type { FoundPatient } from "../../registry/types/registry.types"
import { auditSubjectOf } from "../../registry/utils/patient-view"

// CAP-014-R08, administration.yaml AuditRecord.assignment_change
export function assignmentChangeOf(
	previousPatient: FoundPatient,
	newPatient: FoundPatient,
	previousEncounterId: string,
	newEncounterId: string,
): JsonObject | null {
	const previousIdentifier = auditSubjectOf(previousPatient)
	const newIdentifier = auditSubjectOf(newPatient)
	if (previousIdentifier === undefined || newIdentifier === undefined) {
		return null
	}
	return {
		previous_patient_identifier: previousIdentifier,
		new_patient_identifier: newIdentifier,
		previous_encounter_id: previousEncounterId,
		new_encounter_id: newEncounterId,
	}
}
