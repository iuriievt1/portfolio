import type { AUDIT_SEARCH_METHOD, EmptiedBy, EncounterAction, ERROR_CODE, MobileContract } from "@ansora/contracts"
import type { EncounterStatus, NewRecordRefusal } from "@ansora/vulna-domain"
import type { AcquisitionRow } from "../../acquisition/types/acquisition.types"
import type { AuditActor } from "../../audit/types/audit.types"
import type { FoundPatient } from "../../registry/types/registry.types"

type MobileSchemas = MobileContract.components["schemas"]

export type EncounterView = MobileSchemas["Encounter"]
export type EncountersPageView = MobileSchemas["EncountersPage"]
export type ScheduledEncounterListView = MobileSchemas["ScheduledEncounterList"]
export type UnfinishedEncounterListView = MobileSchemas["UnfinishedEncounterList"]
export type UnfinishedEncounterItemView = MobileSchemas["UnfinishedEncounterItem"]
export type EncounterAcquisitionsPageView = MobileSchemas["EncounterAcquisitionsPage"]

type EncounterSource = EncounterView["source"]

// CAP-025-R18
export type EncounterListMethod =
	| typeof AUDIT_SEARCH_METHOD.PATIENT_ENCOUNTERS
	| typeof AUDIT_SEARCH_METHOD.SCHEDULED_LIST

// CAP-025-R27
export type EncounterRefusal =
	| NewRecordRefusal
	| typeof ERROR_CODE.ENCOUNTER_HAS_DRAFT
	| typeof ERROR_CODE.ENCOUNTER_WITHOUT_CLOSED_RECORD
	| typeof ERROR_CODE.ENCOUNTER_HAS_CLOSED_RECORD

export interface EncounterRow {
	id: string
	patient_id: string
	source: EncounterSource
	status: EncounterStatus
	date: string
	scheduled_time: string | null
	department_id: string | null
	started_at: Date | null
	encounter_key: string | null
	completed_at: Date | null
	completed_by: string | null
	study_instance_uid: string
	accession_number: string | null
	status_changed_at: Date
	created_at: Date
}

export interface NewEncounter {
	id: string
	patientId: string
	encounterKey: string
	date: string
	departmentId: string | undefined
	studyInstanceUid: string
	startedAt: Date
}

export interface EncounterPage {
	rows: EncounterRow[]
	nextCursor: string | null
}

// CAP-014-R24
export interface PagedEncounterRow extends EncounterRow {
	cursor_moment: string
}

// CAP-014-R24, ADR-012
export interface EncounterCursor {
	date: string
	moment: string
	id: string
}

// CAP-014-R06, clinical-workflow.yaml AcquisitionDraftCreate
export interface EncounterReference {
	encounter_id?: string | undefined
	encounter_key?: string | undefined
}

// CAP-014-R06, CAP-014-R26
export interface EncounterTargetContext {
	patientId: string
	departmentId: string | undefined
	action: EncounterAction
	today: string
	now: Date
}

// CAP-014-R29, CAP-025-R29
export interface EmptyingAct {
	actor: AuditActor
	patient: FoundPatient
	emptiedBy: EmptiedBy
}

// CAP-014-R22, CAP-015-R31, CAP-018-R15
export interface RecordContentRow {
	acquisition_id: string
	has_wound_type: boolean
	has_healing_phase: boolean
	has_document_title: boolean
}

// CAP-014-R22, CAP-015-R35, CAP-015-R36
export interface RecordProgress {
	has_wound_type: boolean
	has_healing_phase: boolean
	has_document_title: boolean
	received_count: number
	announced_count: number
	rejected_count: number
	files_on_other_device: boolean
}

// CAP-015-R17, CAP-026-R17
export interface DiscardedDrafts {
	discarded: AcquisitionRow[]
	binaryObjectIds: string[]
}

// clinical-workflow.yaml listUnfinishedEncounters
export interface UnfinishedEncounterRow {
	encounter_id: string
	last_documented_at: Date
	acquisition_ids: string[]
}

export interface UnfinishedEncounter {
	patient: FoundPatient
	encounter: EncounterView
	lastDocumentedAt: Date
}
