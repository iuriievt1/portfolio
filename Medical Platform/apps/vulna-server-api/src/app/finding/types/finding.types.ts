import type { BodyView, Laterality, MobileContract } from "@ansora/contracts"
import type { BodySite } from "@ansora/vulna-domain"

type Schemas = MobileContract.components["schemas"]

export type FindingView = Schemas["Finding"]
export type FindingsPageView = Schemas["FindingsPage"]
export type BodySiteView = Schemas["BodySite"]
export type AssessmentView = Schemas["Assessment"]

// datovy-model.md 2, CAP-020-R13
export interface FindingRow {
	id: string
	patient_id: string
	department_id: string | null
	finding_key: string
	origin_acquisition_id: string
	created_by: string
	created_at: Date
	wound_type_code: string | null
	wound_type_code_list_version: number | null
	wound_type_set_by: string | null
}

// CAP-017-R02, CAP-020-R19
export interface WoundTypeChoice {
	code: string
	codeListVersion: number
	setBy: string
}

// CAP-017-R02, CAP-017-R16
export interface WoundTypeRequest {
	code: string
	codeListVersion: string
	userId: string
}

export interface NewFinding {
	id: string
	patientId: string
	departmentId: string | null
	findingKey: string
	originAcquisitionId: string
	createdBy: string
}

// CAP-016-R03, CAP-016-R04
export interface BodySiteRow {
	acquisition_id: string
	region_code: string
	laterality: Laterality | null
	view: BodyView
	x: number
	y: number
	body_diagram_version: string
}

export type BodySiteFields = Omit<BodySiteRow, "acquisition_id">

// clinical-workflow.yaml BodySite, ADR-054 bod 2
export type BodySiteColumns = { [Column in keyof BodySiteFields]: BodySiteFields[Column] | null }

// CAP-016-R17, CAP-020-R13
export interface ChosenFinding {
	finding: FindingRow
	closedSite: BodySite | undefined
}

// CAP-016-R17, CAP-020-R20
export interface TrackedFindingRow {
	id: string
	patient_id: string
	wound_number: number | null
	created_at: Date
	last_acquisition_id: string
	last_closed_at: Date
	cursor_moment: string
	wound_type_code: string | null
	wound_type_code_list_version: number | null
	last_healing_phase_code: string | null
	last_description: string | null
	last_assessment_code_list_version: number | null
	region_code: string | null
	laterality: Laterality | null
	view: BodyView | null
	x: number | null
	y: number | null
	body_diagram_version: string | null
	cover_image_id: string | null
}

// ADR-054 bod 2, CAP-020-R16
export interface VisibleFindings {
	findingIds: readonly string[]
	acquisitionIds: readonly string[]
}

export interface TrackedFindingPage {
	rows: TrackedFindingRow[]
	nextCursor: string | null
}

// CAP-016-R17, CAP-015-R31
export interface LocatedDraft {
	id: string
	patient_id: string
	department_id: string | null
	finding_id: string | null
}

// CAP-017-R03, CAP-017-R04, CAP-017-R09
export interface AssessmentRow {
	acquisition_id: string
	healing_phase_code: string | null
	code_list_version: number | null
	description: string | null
}

export type AssessmentFields = Omit<AssessmentRow, "acquisition_id">

export interface StoredAssessment {
	acquisitionId: string
	healingPhaseCode: string | null
	codeListVersion: number | null
	description: string | null
}

// CAP-017-R03, CAP-017-R04, CAP-017-R09
export interface AssessmentRequest {
	healingPhaseCode: string | undefined
	codeListVersion: string | undefined
	description: string | undefined
}

// CAP-017-R09, CAP-017-R16
export interface AssessmentChoice {
	healingPhaseCode: string | undefined
	codeListVersion: number | undefined
	description: string | undefined
}
