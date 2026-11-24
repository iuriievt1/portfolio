import type { EncounterStatus, PatientSex, RegistrySyncOutcome } from "@ansora/contracts"
import type { DimseSettings } from "@ansora/vulna-adapter-dicom-dimse"
import type {
	EncounterSource,
	PatientGroup,
	PatientIdentifier,
	RegistrySourcePort,
	ScheduledEncounter,
	SourcedPatientRecord,
} from "@ansora/vulna-domain"
import type { UpsertOutcome } from "../constants/registry-sync.constants"

export type RegistrySourceFactory = (settings: DimseSettings) => RegistrySourcePort

export interface RegistrySyncSettings {
	daysBack: number
	daysAhead: number
	periodSeconds: number | undefined
}

export interface SyncRun {
	id: string
	startedAt: Date
}

export interface SyncCounts {
	patientsAdded: number
	patientsChanged: number
	encountersAdded: number
	encountersChanged: number
}

export interface FinishedSyncRun extends SyncRun, SyncCounts {
	finishedAt: Date
	outcome: RegistrySyncOutcome
}

export interface RegistrySnapshot {
	patients: PatientGroup[]
	encounters: ScheduledEncounter[]
	isComplete: boolean
	characterSetMissing: boolean
}

export interface DocumentedRefresh {
	records: SourcedPatientRecord[]
	isComplete: boolean
	characterSetMissing: boolean
}

export interface PatientUpsert {
	patientId: string
	outcome: UpsertOutcome
}

export interface DocumentedPatient {
	patientId: string
	identifiers: PatientIdentifier[]
}

export interface SyncRunRow {
	id: string
	started_at: Date
}

export interface PatientRow {
	id: string
	family_name: string | null
	given_name: string | null
	birth_date: string | null
	sex: PatientSex | null
}

export interface StoredIdentifierRow {
	system: string
	value: string
	issuer: string | null
}

export interface IdentifierRow extends StoredIdentifierRow {
	patient_id: string
	source: string
	valid_until: Date | null
}

export interface EncounterRow {
	id: string
	source: EncounterSource
	status: EncounterStatus
}
