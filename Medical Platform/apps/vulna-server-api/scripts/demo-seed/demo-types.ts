import type { AcquisitionKind, BodyView, Laterality } from "@ansora/contracts"
import type { StoredBinaryObject } from "../../src/app/binary-object/types/binary-object.types"
import type { AssetKind } from "./files"

export interface DemoVisit {
	key: string
	startedAt: string
	completedAt: string
}

export interface DemoRecord {
	visit: string
	closedAt: string
	healingPhase: string
	note: string | undefined
	photos: readonly string[]
}

export interface DemoWoundTypeChange {
	changedAt: string
	from: string
	to: string
}

export interface DemoWound {
	key: string
	regionCode: string
	view: BodyView
	laterality: Laterality | null
	woundType: string
	change: DemoWoundTypeChange | undefined
	records: readonly DemoRecord[]
}

export interface DemoDocument {
	key: string
	visit: string
	closedAt: string
	title: string
	pages: readonly string[]
}

export interface DemoPatient {
	key: string
	identifier: string
	visits: readonly DemoVisit[]
	wounds: readonly DemoWound[]
	documents: readonly DemoDocument[]
}

export interface DemoTitle {
	code: string
	names: Readonly<Record<string, string>>
}

export interface DemoDataset {
	patientIdSystem: string
	issuer: string
	titles: readonly DemoTitle[]
	patients: readonly DemoPatient[]
}

export interface SeedContext {
	operatorUserId: string
	departmentId: string
	configurationVersionId: number
	codeListVersion: number
	titleCodes: ReadonlyMap<string, string>
}

export interface PlannedEncounter {
	id: string
	patient_id: string
	date: string
	started_at: Date
	completed_at: Date
	encounter_key: string
	study_instance_uid: string
}

export interface PlannedAcquisition {
	id: string
	idempotency_key: string
	patient_id: string
	encounter_id: string
	finding_id: string | null
	kind: AcquisitionKind
	started_at: Date
	closed_at: Date
	file_count: number
	closed_wound_type_code: string | null
}

export interface PlannedFinding {
	id: string
	patient_id: string
	finding_key: string
	origin_acquisition_id: string
	created_at: Date
	wound_type_code: string
}

export interface PlannedChange {
	id: string
	finding_id: string
	changed_at: Date
	previous_wound_type_code: string
	wound_type_code: string
}

export interface PlannedSite {
	acquisition_id: string
	region_code: string
	laterality: Laterality | null
	view: BodyView
	x: number
	y: number
	body_diagram_version: string
}

export interface PlannedAssessment {
	acquisition_id: string
	healing_phase_code: string
	description: string | null
	updated_at: Date
}

export interface PlannedFile {
	id: string
	acquisition_id: string
	file_key: string
	sequence: number
	asset_kind: AssetKind
	asset_name: string
	received_at: Date
}

export interface PlannedDocument {
	id: string
	acquisition_id: string
	title: string
}

export interface DemoPlan {
	encounters: PlannedEncounter[]
	acquisitions: PlannedAcquisition[]
	findings: PlannedFinding[]
	changes: PlannedChange[]
	sites: PlannedSite[]
	assessments: PlannedAssessment[]
	images: PlannedFile[]
	documents: PlannedDocument[]
	pages: PlannedFile[]
}

export interface StoredAsset {
	original: StoredBinaryObject
	thumbnail: StoredBinaryObject
}
