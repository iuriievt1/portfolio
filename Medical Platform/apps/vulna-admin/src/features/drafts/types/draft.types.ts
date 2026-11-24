import type { AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type AdministeredDraft = Schemas["AcquisitionDraftForAdministration"]

export type AdministeredDraftsPage = Schemas["AcquisitionDraftsPage"]

export type DraftDiscardRequest = Schemas["DraftDiscardRequest"]

export type DraftDiscardResult = Schemas["DraftDiscardResult"]

export interface DraftFilter {
	operatorUserId: string | undefined
	isStaleOnly: boolean
}

export interface DraftTiming {
	reminderSeconds: number | undefined
	absenceSeconds: number | undefined
}

export interface DraftQuery {
	operatorUserId: string | undefined
	notUpdatedSince: string | undefined
}

export interface DraftSelection {
	selectedIds: ReadonlySet<string>
	isSelectable: boolean
	isAllSelected: boolean
	toggle: (draftId: string) => void
	toggleAll: () => void
}
