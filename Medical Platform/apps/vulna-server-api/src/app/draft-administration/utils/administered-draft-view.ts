import { OPERATOR_STATE } from "@ansora/contracts"
import { shownIdentifierOf } from "../../registry/utils/patient-view"
import type {
	AdministeredDraftContext,
	AdministeredDraftRow,
	AdministeredDraftView,
} from "../types/draft-administration.types"

// administration.yaml AcquisitionDraftForAdministration, CAP-004-R14, CAP-003
export function administeredDraftViewOf(
	row: AdministeredDraftRow,
	context: AdministeredDraftContext,
): AdministeredDraftView {
	const patientIdentifier = shownIdentifierOf(context.patient)
	if (patientIdentifier === undefined) {
		throw new Error(`the patient ${row.patient_id} of the draft ${row.id} has no identifier`)
	}
	return {
		acquisition_id: row.id,
		kind: row.kind,
		operator_user_id: row.operator_user_id,
		operator_display_name: row.operator_display_name,
		operator_state: context.presence.is_active ? OPERATOR_STATE.ACTIVE : OPERATOR_STATE.REVOKED,
		last_login_at: context.presence.last_login_at?.toISOString() ?? null,
		patient_id: row.patient_id,
		patient_identifier: patientIdentifier,
		encounter_id: row.encounter_id,
		file_count: context.receivedFileCount,
		started_at: row.started_at.toISOString(),
		updated_at: row.updated_at_moment,
		is_discard_consent_allowed: context.isDiscardConsentAllowed,
	}
}
