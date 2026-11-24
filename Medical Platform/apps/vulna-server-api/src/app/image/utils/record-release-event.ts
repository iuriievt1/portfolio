import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, type JsonObject } from "@ansora/core-server"
import type { UserAuditEvent } from "../../audit/types/audit.types"
import { withPatientSubject } from "../../registry/utils/patient-view"
import type { RecordRelease } from "../types/image.types"

// CAP-025-R28, CAP-020-R05, CAP-025-R23
export function recordReleaseEventOf(release: RecordRelease): UserAuditEvent {
	const details: JsonObject = {}
	if (release.kind !== undefined) {
		details.release_kind = release.kind
	}
	if (release.encounterId !== undefined) {
		details.encounter_id = release.encounterId
	}
	if (release.acquisitionId !== undefined) {
		details.acquisition_id = release.acquisitionId
	}
	details.released_item_count = release.releasedItemCount
	return {
		eventType: AUDIT_EVENT_TYPE.PATIENT_RECORD_RELEASE,
		objectId: release.objectId,
		outcome: AUDIT_OUTCOME.RELEASED,
		details: release.patient === undefined ? details : withPatientSubject(release.patient, details),
	}
}
