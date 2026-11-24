import {
	ACQUISITION_VERSION_HEADER,
	IDEMPOTENCY_KEY_HEADER,
	type MobileContract,
	REQUEST_KEY_HEADER,
} from "@ansora/contracts"
import { ACCEPTS_OUTDATED_APP, callApi } from "./client"
import { withQuery } from "./query"

type Schemas = MobileContract.components["schemas"]

export type AcquisitionDraftSummary = Schemas["AcquisitionDraftSummary"]
type AcquisitionDraftsPage = Schemas["AcquisitionDraftsPage"]
type AcquisitionDraftCreate = Schemas["AcquisitionDraftCreate"]
export type AcquisitionReceipt = Schemas["AcquisitionReceipt"]
export type AcquisitionDraft = Schemas["AcquisitionDraft"]
export type AcquisitionAssignment = Schemas["AcquisitionAssignment"]
export type AcquisitionDraftUpdate = Schemas["AcquisitionDraftUpdate"]
export type AcquisitionClosure = Schemas["AcquisitionClosure"]
export type DocumentTitle = Schemas["DocumentTitle"]
type AcquisitionDiscard = Schemas["AcquisitionDiscardRequest"]

const DRAFTS_PATH: keyof MobileContract.paths = "/acquisitions"

export function draftPath(acquisitionId: string): string {
	return `${DRAFTS_PATH}/${encodeURIComponent(acquisitionId)}`
}

// index.yaml AcquisitionVersion
export function versionTagOf(version: number): string {
	return `"${version}"`
}

export const acquisitionApi = {
	// CAP-015-R29, CAP-012-R25
	listAcquisitionDrafts: (sessionToken: string, cursor: string | undefined): Promise<AcquisitionDraftsPage> =>
		callApi<AcquisitionDraftsPage>(withQuery(DRAFTS_PATH, { cursor }), { sessionToken, ...ACCEPTS_OUTDATED_APP }),
	// CAP-015-R30, CAP-014-R06, CAP-021-R08
	createAcquisitionDraft: (
		sessionToken: string,
		draft: AcquisitionDraftCreate,
		idempotencyKey: string,
	): Promise<AcquisitionReceipt> =>
		callApi<AcquisitionReceipt>(DRAFTS_PATH, {
			method: "POST",
			body: draft,
			sessionToken,
			headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
		}),
	// CAP-015-R15, CAP-014-R25, CAP-012-R25
	getAcquisitionDraft: (sessionToken: string, acquisitionId: string): Promise<AcquisitionDraft> =>
		callApi<AcquisitionDraft>(draftPath(acquisitionId), { sessionToken, ...ACCEPTS_OUTDATED_APP }),
	// CAP-015-R30, CAP-016-R17, CAP-021-R29, CAP-021-R32, CAP-012-R25
	updateAcquisitionDraft: (
		sessionToken: string,
		draft: Pick<AcquisitionDraft, "acquisition_id" | "version">,
		update: AcquisitionDraftUpdate,
		requestKey: string,
	): Promise<AcquisitionDraft> =>
		callApi<AcquisitionDraft>(draftPath(draft.acquisition_id), {
			method: "PATCH",
			body: update,
			sessionToken,
			headers: { [ACQUISITION_VERSION_HEADER]: versionTagOf(draft.version), [REQUEST_KEY_HEADER]: requestKey },
			...ACCEPTS_OUTDATED_APP,
		}),
	// CAP-014-R14, CAP-021-R25, CAP-021-R29, CAP-021-R32, CAP-012-R25
	closeAcquisition: (
		sessionToken: string,
		draft: Pick<AcquisitionDraft, "acquisition_id" | "version">,
		closure: AcquisitionClosure,
	): Promise<AcquisitionReceipt> =>
		callApi<AcquisitionReceipt>(`${draftPath(draft.acquisition_id)}/closure`, {
			method: "POST",
			body: closure,
			sessionToken,
			headers: { [ACQUISITION_VERSION_HEADER]: versionTagOf(draft.version) },
			...ACCEPTS_OUTDATED_APP,
		}),
	// CAP-014-R07, CAP-014-R25, CAP-021-R32
	setAcquisitionAssignment: (
		sessionToken: string,
		draft: Pick<AcquisitionDraft, "acquisition_id" | "version">,
		assignment: AcquisitionAssignment,
	): Promise<AcquisitionDraft> =>
		callApi<AcquisitionDraft>(`${draftPath(draft.acquisition_id)}/assignment`, {
			method: "PUT",
			body: assignment,
			sessionToken,
			headers: { [ACQUISITION_VERSION_HEADER]: versionTagOf(draft.version) },
		}),
	// CAP-015-R17, CAP-015-R18, CAP-021-R32
	discardAcquisitionDraft: (
		sessionToken: string,
		draft: Pick<AcquisitionDraft, "acquisition_id" | "version">,
		discard: AcquisitionDiscard,
	): Promise<void> =>
		callApi<void>(`${draftPath(draft.acquisition_id)}/discard`, {
			method: "POST",
			body: discard,
			sessionToken,
			headers: { [ACQUISITION_VERSION_HEADER]: versionTagOf(draft.version) },
		}),
	// CAP-015-R37, CAP-021-R29
	cancelAcquisitionDraft: (sessionToken: string, acquisitionId: string): Promise<void> =>
		callApi<void>(`${draftPath(acquisitionId)}/cancellation`, { method: "POST", sessionToken }),
}
