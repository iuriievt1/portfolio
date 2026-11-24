import type {
	AdministrationContract,
	AUDIT_SEARCH_METHOD,
	MobileContract,
	PatientIdentificationMethod,
	PatientSex,
} from "@ansora/contracts"

type MobileSchemas = MobileContract.components["schemas"]

export type PatientView = MobileSchemas["Patient"]
export type PatientSearchResult = MobileSchemas["PatientSearchResult"]
export type SyncStateView = AdministrationContract.components["schemas"]["SyncState"]

export interface PatientRow {
	id: string
	sex: PatientSex | null
}

export interface PatientIdentifierRow {
	patient_id: string
	system: string
	value: string
	issuer: string | null
}

export interface FoundPatient {
	patient: PatientRow
	identifiers: PatientIdentifierRow[]
}

// CAP-025-R18, CHG-182
export type PatientSearchMethod = PatientIdentificationMethod | typeof AUDIT_SEARCH_METHOD.IDENTIFIER_SEARCH

export interface PatientIdentification {
	created: boolean
	found: FoundPatient[]
}

export interface SyncRunStateRow {
	started_at: Date
	finished_at: Date | null
	outcome: string | null
	failed: boolean
}
