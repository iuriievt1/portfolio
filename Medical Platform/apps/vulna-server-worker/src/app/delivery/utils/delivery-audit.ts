import { type AdministratorAlertKind, SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, type AuditEventType, type JsonObject } from "@ansora/core-server"
import {
	type ArchiveExchange,
	type ArchiveStoreOutcome,
	COUNTED_ATTEMPT,
	DIMSE_STATUS,
	STORE_DECISION,
	type StoreJudgement,
} from "@ansora/vulna-domain"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import { TAKEN_OVER_RESULT } from "../constants/delivery.constants"
import type { DeliveryInstance, VerificationLevel } from "../types/delivery.types"

// datovy-model.md 8, CAP-023-R21
export function instanceDetailsOf(instance: DeliveryInstance): JsonObject {
	return {
		delivery_id: instance.deliveryId,
		delivery_instance_id: instance.id,
		acquisition_id: instance.acquisitionId,
		artifact_id: instance.artifactId,
		sop_instance_uid: instance.sopInstanceUid,
		target_code: instance.targetCode,
	}
}

// integrace-dicom.md 6.2, 8, CAP-023-R07, CAP-023-R21
function exchangeDetailsOf(exchange: ArchiveExchange): JsonObject {
	return {
		phase: exchange.phase,
		rule_id: exchange.classification.ruleId,
		status: exchange.statusHex ?? null,
		not_sent_reason: exchange.notSentReason ?? null,
		timeout: exchange.timeout ?? null,
		error_comment: exchange.errorComment ?? null,
	}
}

function deliveryEventOf(
	eventType: AuditEventType,
	instance: DeliveryInstance,
	isSuccess: boolean,
	details: JsonObject,
): SystemJobAuditEvent {
	return {
		eventType,
		systemJob: SYSTEM_JOB.DELIVERY,
		objectId: instance.id,
		outcome: isSuccess ? AUDIT_OUTCOME.SUCCESS : AUDIT_OUTCOME.FAILURE,
		details: { ...instanceDetailsOf(instance), ...details },
	}
}

// CAP-023-R07, CAP-023-R12, NAB-437, NAB-399
export function deliveryAttemptEventOf(
	instance: DeliveryInstance,
	outcome: ArchiveStoreOutcome,
	judgement: StoreJudgement,
): SystemJobAuditEvent {
	return deliveryEventOf(
		AUDIT_EVENT_TYPE.DELIVERY_ATTEMPT,
		instance,
		judgement.decision.kind === STORE_DECISION.CONFIRMED,
		{
			...exchangeDetailsOf(outcome),
			result: judgement.decision.kind,
			is_counted: judgement.countedAttempts === COUNTED_ATTEMPT,
			attempts: judgement.attempts,
			accepted_transfer_syntax: outcome.acceptedTransferSyntax ?? null,
		},
	)
}

// CAP-023-R25, CAP-023-S14, dorucovaci-jadro.md 5.4
export function takenOverEventOf(instance: DeliveryInstance, attempts: number): SystemJobAuditEvent {
	return deliveryEventOf(AUDIT_EVENT_TYPE.DELIVERY_ATTEMPT, instance, false, {
		result: TAKEN_OVER_RESULT,
		is_counted: true,
		attempts,
	})
}

// CAP-023-R07, CAP-023-R26, datovy-model.md 8
export function verificationQueryEventOf(
	instance: DeliveryInstance,
	level: VerificationLevel,
	exchange: ArchiveExchange,
	result: string,
	rejectionsInARow: number | undefined,
): SystemJobAuditEvent {
	return deliveryEventOf(AUDIT_EVENT_TYPE.VERIFICATION_QUERY, instance, exchange.statusHex === DIMSE_STATUS.SUCCESS, {
		...exchangeDetailsOf(exchange),
		level,
		result,
		...(rejectionsInARow === undefined ? {} : { rejections_in_a_row: rejectionsInARow }),
	})
}

// CAP-023-R26, CAP-023-S18
export function verificationOnHoldEventOf(instance: DeliveryInstance, rejections: number): SystemJobAuditEvent {
	return deliveryEventOf(AUDIT_EVENT_TYPE.VERIFICATION_ON_HOLD, instance, false, { rejections_in_a_row: rejections })
}

// CAP-023-R23, CAP-023-R24, CAP-023-R27, datovy-model.md 8
export function targetEventOf(
	eventType: AuditEventType,
	targetCode: string,
	reason: string | undefined,
	details: JsonObject = {},
): SystemJobAuditEvent {
	return {
		eventType,
		systemJob: SYSTEM_JOB.DELIVERY,
		objectId: undefined,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: { target_code: targetCode, reason: reason ?? null, ...details },
	}
}

// CAP-028-R15, datovy-model.md 8
export function deliveryAlertEventOf(
	alertId: string,
	kind: AdministratorAlertKind,
	message: string,
	subject: JsonObject,
): SystemJobAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
		systemJob: SYSTEM_JOB.DELIVERY,
		objectId: alertId,
		outcome: AUDIT_OUTCOME.FAILURE,
		details: { alert_id: alertId, alert_kind: kind, message, ...subject },
	}
}
