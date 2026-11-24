import type { Identifier, PatientIdentifier, PatientRecord } from "./patient-directory.port"

// closed; instance zone
export interface DayInterval {
	from: string
	to: string
}

// CAP-014-R16, CAP-014-R04, integrace-dicom.md 4
export interface ScheduledEncounter {
	patient: PatientRecord
	studyInstanceUid: string
	accessionNumber: string | undefined
	// integrace-dicom.md 5.9
	identifiers: readonly Identifier[]
	scheduledDate: string
	scheduledTime: string | undefined
}

// ADR-005 ř. 39, CAP-024-R08, CAP-024-R14
export const REGISTRY_QUERY_OUTCOME = {
	COMPLETE: "complete",
	TOO_MANY_MATCHES: "too_many_matches",
	INCOMPLETE: "incomplete",
} as const

export type RegistryQueryOutcome = (typeof REGISTRY_QUERY_OUTCOME)[keyof typeof REGISTRY_QUERY_OUTCOME]

export interface RegistryQueryResult<T> {
	outcome: RegistryQueryOutcome
	matches: readonly T[]
	// CAP-024-R11
	characterSetMissing: boolean
}

// ADR-035 bod 2, architektura.md 3
export interface RegistrySourcePort {
	scheduledEncounters(interval: DayInterval): Promise<RegistryQueryResult<ScheduledEncounter>>
	studyPatients(interval: DayInterval): Promise<RegistryQueryResult<PatientRecord>>
	patient(identifier: PatientIdentifier): Promise<RegistryQueryResult<PatientRecord>>
}
