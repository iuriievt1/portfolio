import { AUDIT_ACTOR_KIND, AUDIT_OUTCOME, type AuditEventType, type JsonObject } from "@ansora/core-server"
import type { NewAuditEvent, UserAuditEvent } from "../../audit/types/audit.types"
import { userAuditEventOf } from "../../audit/utils/user-audit-event"
import type { CurrentSession } from "../../login/types/login.types"
import type { FoundPatient } from "../../registry/types/registry.types"
import { withPatientSubject } from "../../registry/utils/patient-view"
import type { AcquisitionRow } from "../types/acquisition.types"
import type { QueueSender } from "../types/queue-sender.types"
import { senderDeviceOf, senderSessionOf } from "./queue-sender"

// CAP-025-R26, CAP-025-R23
export function draftEventOf(
	patient: FoundPatient,
	draft: AcquisitionRow,
	eventType: AuditEventType,
	details: JsonObject,
): UserAuditEvent {
	return {
		eventType,
		objectId: draft.id,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: withPatientSubject(patient, {
			encounter_id: draft.encounter_id,
			acquisition_id: draft.id,
			operator_user_id: draft.operator_user_id,
			...details,
		}),
	}
}

// CAP-025-R26, CAP-025-R23
export function draftAuditEventOf(
	current: CurrentSession,
	patient: FoundPatient,
	draft: AcquisitionRow,
	eventType: AuditEventType,
	details: JsonObject = {},
): NewAuditEvent {
	return userAuditEventOf(current, draftEventOf(patient, draft, eventType, details))
}

// CAP-025-R17, CAP-025-R26, CAP-002-R09, ADR-014
export function queueAuditEventOf(
	sender: QueueSender,
	patient: FoundPatient,
	draft: AcquisitionRow,
	eventType: AuditEventType,
): NewAuditEvent {
	const event = draftEventOf(patient, draft, eventType, {})
	const actorDeviceId = senderDeviceOf(sender).id
	const session = senderSessionOf(sender)
	if (session === undefined) {
		return { ...event, actorKind: AUDIT_ACTOR_KIND.DEVICE, actorDeviceId }
	}
	return {
		...event,
		actorKind: AUDIT_ACTOR_KIND.USER,
		actorUserId: session.userId,
		actorDeviceId,
		sessionId: session.sessionId,
	}
}
