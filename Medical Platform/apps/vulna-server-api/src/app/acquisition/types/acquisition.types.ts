import type { AcquisitionKind, MobileContract } from "@ansora/contracts"
import type { AcquisitionState } from "@ansora/vulna-domain"
import type { AssessmentChoice, AssessmentRow, BodySiteView, WoundTypeChoice } from "../../finding/types/finding.types"
import type { DECISION_REASON } from "../constants/acquisition.constants"
import type { AcquisitionDraftUpdateInput } from "../dto/acquisition-draft-update.input.dto"
import type { AcquisitionDraftFileView, DocumentTitleView } from "./acquisition-file.types"

type MobileSchemas = MobileContract.components["schemas"]

export type AcquisitionReceiptView = MobileSchemas["AcquisitionReceipt"]
export type AcquisitionDraftView = MobileSchemas["AcquisitionDraft"]
export type AcquisitionDraftSummaryView = MobileSchemas["AcquisitionDraftSummary"]
export type AcquisitionDraftsPageView = MobileSchemas["AcquisitionDraftsPage"]
export type EncounterAcquisitionItemView = MobileSchemas["EncounterAcquisitionItem"]

export interface AcquisitionRow {
	id: string
	idempotency_key: string
	patient_id: string
	encounter_id: string
	finding_id: string | null
	kind: AcquisitionKind
	state: AcquisitionState
	operator_user_id: string
	department_id: string | null
	configuration_version_id: number
	started_at: Date
	closed_at: Date | null
	file_count: number | null
	version: number
	updated_at: Date
}

export interface NewDraft {
	id: string
	idempotencyKey: string
	patientId: string
	encounterId: string
	kind: AcquisitionKind
	operatorUserId: string
	operatorSessionId: string
	departmentId: string | undefined
	configurationVersionId: number
	startedAt: Date
}

// CAP-014-R14, CAP-021-R13, CAP-021-R25, CAP-020-R19
export interface DraftClosing {
	closedAt: Date
	fileCount: number
	closingSessionId: string
	closingDeviceId: string
}

// CAP-021-R13, CAP-019-R29
export interface OperatorClaim {
	userId: string
	sessionId: string
}

// datovy-model.md 3, CAP-021-R11
export interface SeriesRow {
	id: string
	series_instance_uid: string
	series_number: number
}

// CAP-021-R39, ADR-050 (doplnění D33) bod 3
export interface DocumentSeriesRow {
	encounter_id: string
	series_instance_uid: string
}

// datovy-model.md 3, CAP-021-R11
export type SeriesOwner = { encounterId: string } & (
	| { findingId: string; documentId?: undefined }
	| { documentId: string; findingId?: undefined }
)

// CAP-014-R07, CAP-014-R26
export interface Assignment {
	patientId: string
	encounterId: string
	findingId: string | null
}

export type DecisionReason = (typeof DECISION_REASON)[keyof typeof DECISION_REASON]

// CAP-014-R22, CAP-015-R29
export interface PagedAcquisitionRow extends AcquisitionRow {
	cursor_moment: string
}

export interface DraftPage {
	rows: AcquisitionRow[]
	nextCursor: string | null
}

export interface DraftCreation {
	created: boolean
	receipt: AcquisitionReceiptView
}

// CAP-003-R01
export interface Viewer {
	userId: string
	departmentId: string | undefined
}

export interface EncounterRecordCount {
	encounter_id: string
	count: number
}

// CAP-021-R29, CAP-021-R32
export interface DraftUpdate {
	acquisitionId: string
	version: number
	requestKey: string
	input: AcquisitionDraftUpdateInput
}

// CAP-021-R29, CAP-021-S24
export interface AcquisitionUpdateRequestRow {
	body_sha256: Buffer
	response: AcquisitionDraftView | null
}

export interface NewUpdateRequest {
	acquisitionId: string
	requestKey: string
	fingerprint: Buffer
	response: AcquisitionDraftView
}

// CAP-016-R17, CAP-017-R02, CAP-017-R03
export interface DraftWound {
	bodySite: BodySiteView | undefined
	woundTypeCode: string | null
	assessment: AssessmentRow | undefined
}

// CAP-012-R31, CAP-015-R18
export interface DraftReminder {
	now: Date
	reminderSeconds: number
}

// CAP-015-R35, CAP-018-R15
export interface DraftContent {
	files: AcquisitionDraftFileView[]
	documentTitle: DocumentTitleView | undefined
}

// CAP-017-R02, CAP-017-R03, CAP-017-R16
export interface CheckedContent {
	woundType: WoundTypeChoice | undefined
	assessment: AssessmentChoice | undefined
}
