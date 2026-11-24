import type { AcquisitionDraftSummary } from "../../api/acquisitions"
import { ROUTE } from "../../navigation/routes"
import { openPatient } from "../patient/opened-patient"
import { summaryRouteOf } from "../visit/draft-route"
import { openVisit } from "../visit/opened-visit"

type OwnDraftHref =
	| { pathname: typeof ROUTE.PATIENT; params: { id: string } }
	| { pathname: typeof ROUTE.VISIT; params: { id: string } }

type OwnDraftSummaryHref =
	| OwnDraftHref
	| {
			pathname: typeof ROUTE.CAPTURE_SUMMARY | typeof ROUTE.SCAN_SUMMARY
			params: { id: string; acquisitionId: string }
	  }

// CAP-015-R29, CAP-014-R23, CAP-015-S38
export function openOwnDraft(draft: AcquisitionDraftSummary): OwnDraftHref {
	const id = openDraftVisit(draft)
	if (id === undefined) {
		openPatient(draft.patient)
		return { pathname: ROUTE.PATIENT, params: { id: draft.patient.patient_id } }
	}
	return { pathname: ROUTE.VISIT, params: { id } }
}

// CAP-015-R16, CAP-015-S09
export function openOwnDraftSummary(draft: AcquisitionDraftSummary): OwnDraftSummaryHref {
	const id = openDraftVisit(draft)
	if (id === undefined) {
		return openOwnDraft(draft)
	}
	return { pathname: summaryRouteOf(draft.kind), params: { id, acquisitionId: draft.acquisition_id } }
}

function openDraftVisit(draft: AcquisitionDraftSummary): string | undefined {
	const encounterId = draft.encounter_id ?? undefined
	if (encounterId === undefined) {
		return undefined
	}
	return openVisit({ patient: draft.patient, encounterId, encounterKey: undefined, openedAt: new Date() })
}
