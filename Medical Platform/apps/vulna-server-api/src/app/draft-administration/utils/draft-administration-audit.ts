import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import type { UserAuditEvent } from "../../audit/types/audit.types"
import type {
	AdministeredDraftView,
	DraftDiscardConsent,
	DraftDiscardCounts,
} from "../types/draft-administration.types"

// CAP-004-R14, CAP-025-R03, datovy-model.md 8
export function draftsViewedEventOf(
	operatorUserId: string | undefined,
	items: readonly AdministeredDraftView[],
): UserAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.ACQUISITION_DRAFTS_VIEWED,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			operator_user_id: operatorUserId ?? null,
			released_item_count: items.length,
			patient_identifiers: [...new Set(items.map((item) => item.patient_identifier))],
		},
	}
}

// CAP-015-R19, CAP-015-R20, CAP-025-R03, datovy-model.md 8
export function consentGrantedEventOf(
	consent: DraftDiscardConsent,
	selectedAcquisitionIds: readonly string[],
	counts: DraftDiscardCounts,
): UserAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.DRAFT_DISCARD_CONSENT_GRANTED,
		objectId: consent.id,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			draft_discard_consent_id: consent.id,
			operator_user_id: consent.operatorUserId,
			administrator_user_id: consent.administratorUserId,
			reason: consent.reason,
			acquisition_ids: [...selectedAcquisitionIds],
			discarded_count: counts.discarded,
			refused_count: counts.refused,
		},
	}
}
