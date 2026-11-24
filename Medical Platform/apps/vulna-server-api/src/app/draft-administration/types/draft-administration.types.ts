import type { AcquisitionKind, AdministrationContract, DraftDiscardReason } from "@ansora/contracts"
import type { AcquisitionRow } from "../../acquisition/types/acquisition.types"
import type { EncounterRow } from "../../encounter/types/encounter.types"
import type { MomentPage } from "../../infra/utils/cursor-moment"
import type { FoundPatient } from "../../registry/types/registry.types"

type AdministrationSchemas = AdministrationContract.components["schemas"]

export type AdministeredDraftView = AdministrationSchemas["AcquisitionDraftForAdministration"]
export type AdministeredDraftsPageView = AdministrationSchemas["AcquisitionDraftsPage"]
export type DraftDiscardResultView = AdministrationSchemas["DraftDiscardResult"]
export type DraftDiscardRefusalView = DraftDiscardResultView["refused"][number]

export interface AdministeredDraftRow {
	id: string
	kind: AcquisitionKind
	operator_user_id: string
	operator_display_name: string
	patient_id: string
	encounter_id: string
	started_at: Date
	updated_at_moment: string
}

export interface AdministeredDraftQuery {
	limit: number
	cursor: string | undefined
	operatorUserId: string | undefined
	notUpdatedSince: string | undefined
}

export type AdministeredDraftPage = MomentPage<AdministeredDraftRow>

export interface OperatorPresenceRow {
	user_id: string
	is_active: boolean
	last_login_at: Date | null
	has_active_session: boolean
}

export interface AdministeredDraftContext {
	patient: FoundPatient
	presence: OperatorPresenceRow
	receivedFileCount: number
	isDiscardConsentAllowed: boolean
}

export interface DiscardSelection {
	acquisitionId: string
	seenUpdatedAt: string
}

export type DraftVerdict =
	| { refusal: DraftDiscardRefusalView }
	| { refusal: undefined; draft: AcquisitionRow; encounter: EncounterRow }

export interface SelectedDraft {
	selection: DiscardSelection
	draft: AcquisitionRow | undefined
}

export interface DraftDiscardRequest {
	operatorUserId: string
	reason: DraftDiscardReason
	selections: DiscardSelection[]
}

export interface DraftDiscardConsent {
	id: string
	operatorUserId: string
	administratorUserId: string
	reason: DraftDiscardReason
	grantedAt: Date
}

export interface DraftDiscardCounts {
	discarded: number
	refused: number
}

export interface DraftDiscardOutcome {
	discarded: string[]
	refused: DraftDiscardRefusalView[]
	binaryObjectIds: string[]
}
