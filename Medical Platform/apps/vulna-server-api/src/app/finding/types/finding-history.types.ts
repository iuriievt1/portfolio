import type { AcquisitionKind, BodyView, Laterality, MobileContract } from "@ansora/contracts"

type Schemas = MobileContract.components["schemas"]

export type TimelinePageView = Schemas["TimelinePage"]
export type TimelineItemView = Schemas["TimelineItem"]
export type WoundTypeChangeView = Schemas["WoundTypeChange"]

// CAP-016-R16, CAP-017-R03, CAP-017-R04
export interface RecordContentFields {
	region_code: string | null
	laterality: Laterality | null
	view: BodyView | null
	x: number | null
	y: number | null
	body_diagram_version: string | null
	healing_phase_code: string | null
	assessment_code_list_version: number | null
	description: string | null
}

// datovy-model.md 4, CAP-020-R19, ADR-006
export interface ClosedWoundTypeFields {
	closed_wound_type_code: string | null
	closed_wound_type_code_list_version: number | null
}

// CAP-020-R20, CAP-020-R07
export interface TimelineRecordRow extends RecordContentFields, ClosedWoundTypeFields {
	id: string
	kind: AcquisitionKind
	closed_at: Date
	cursor_moment: string
	study_instance_uid: string
	accession_number: string | null
}

export interface TimelineRecordPage {
	rows: TimelineRecordRow[]
	nextCursor: string | null
}

// datovy-model.md 2, CAP-020-R19, CAP-020-R21
export interface WoundTypeChangeRow {
	id: string
	finding_id: string
	changed_at: Date
	changed_by: string
	previous_wound_type_code: string
	previous_wound_type_code_list_version: number
	wound_type_code: string
	wound_type_code_list_version: number
}

export interface NewWoundTypeChange {
	id: string
	findingId: string
	changedAt: Date
	changedBy: string
	previousCode: string
	previousCodeListVersion: number
	code: string
	codeListVersion: number
}

// CAP-020-R19
export interface WoundTypeValue {
	code: string | null
	codeListVersion: number | null
}
