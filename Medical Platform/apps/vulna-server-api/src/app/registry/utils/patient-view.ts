import type { JsonObject } from "@ansora/core-server"
import type { FoundPatient, PatientIdentifierRow, PatientView } from "../types/registry.types"

type IdentifierView = PatientView["identifiers"][number]

function identifierViewOf(row: PatientIdentifierRow): IdentifierView {
	const view: IdentifierView = { system: row.system, value: row.value }
	if (row.issuer !== null) {
		view.issuer = row.issuer
	}
	return view
}

// CAP-013-R09, NAB-479, clinical-workflow.yaml Patient, CHG-176
export function patientViewOf(found: FoundPatient): PatientView {
	return {
		patient_id: found.patient.id,
		identifiers: found.identifiers.map(identifierViewOf),
		sex: found.patient.sex,
	}
}

// CAP-013-R09, CHG-176
export function shownIdentifierOf(found: FoundPatient): string | undefined {
	return found.identifiers[0]?.value
}

// CAP-025-R18
export function auditSubjectOf(found: FoundPatient): string | undefined {
	return shownIdentifierOf(found)
}

// CAP-025-R03, CAP-025-R23
export function withPatientSubject(patient: FoundPatient, details: JsonObject): JsonObject {
	const subject = auditSubjectOf(patient)
	return subject === undefined ? details : { patient_identifier: subject, ...details }
}
