import {
	ADMINISTRATOR_ALERT_KIND,
	DELIVERY_INSTANCE_STATE,
	type DeliveryInstanceState,
	HELD_FOR_REVIEW_CAUSE,
	type HeldForReviewCause,
} from "@ansora/contracts"
import { MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import {
	type ArchiveExchange,
	type ArchiveStoreOutcome,
	COUNTED_ATTEMPT,
	deliveryRetryDelaySeconds,
	isAttemptLimitReached,
	NO_VERIFICATION_REJECTIONS,
	PERMANENT_FAILURE_CAUSE,
	type PermanentFailureCause,
	QUERY_RESULT,
	STORE_DECISION,
	STUDY_QUERY_RESULT,
	type StoreJudgement,
} from "@ansora/vulna-domain"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import { NO_DELAY_MILLISECONDS, TARGET_CHANGE, TASK_ACTION, VERIFICATION_LEVEL } from "../constants/delivery.constants"
import type {
	DeliveryInstance,
	DeliverySettings,
	DeliveryStep,
	InstanceAlert,
	InstanceTransition,
	StudyVerification,
	TargetChange,
	TaskAction,
	Verification,
} from "../types/delivery.types"
import {
	heldForReviewMessageOf,
	permanentFailureMessageOf,
	storedWithWarningMessageOf,
	verificationRejectedMessageOf,
} from "./delivery-alert"
import {
	deliveryAttemptEventOf,
	takenOverEventOf,
	verificationOnHoldEventOf,
	verificationQueryEventOf,
} from "./delivery-audit"

const { WAITING, SENDING, PENDING_VERIFICATION, CONFIRMED, TEMPORARILY_FAILED, PERMANENTLY_FAILED, HELD_FOR_REVIEW } =
	DELIVERY_INSTANCE_STATE

const COMPLETE: TaskAction = { kind: TASK_ACTION.COMPLETE }
const FAIL: TaskAction = { kind: TASK_ACTION.FAIL }
const AT_ONCE: TaskAction = { kind: TASK_ACTION.WAIT, delayMilliseconds: NO_DELAY_MILLISECONDS }

type UnansweredResult =
	| typeof QUERY_RESULT.TARGET_UNAVAILABLE
	| typeof QUERY_RESULT.INTERRUPTED
	| typeof QUERY_RESULT.REJECTED

function waitSeconds(seconds: number): TaskAction {
	return { kind: TASK_ACTION.WAIT, delayMilliseconds: seconds * MILLISECONDS_PER_SECOND }
}

function transitionOf(from: DeliveryInstanceState, to: DeliveryInstanceState, rejections: number): InstanceTransition {
	return {
		from,
		to,
		countedAttempts: 0,
		statusHex: undefined,
		acceptedTransferSyntax: undefined,
		heldForReviewCause: undefined,
		verificationRejections: rejections,
		isOnHold: false,
	}
}

function heldAlertOf(
	instance: DeliveryInstance,
	cause: HeldForReviewCause,
	statusHex: string | undefined,
): InstanceAlert {
	return { kind: ADMINISTRATOR_ALERT_KIND.HELD_FOR_REVIEW, message: heldForReviewMessageOf(instance, cause, statusHex) }
}

function permanentAlertOf(
	instance: DeliveryInstance,
	cause: PermanentFailureCause,
	statusHex: string | undefined,
): InstanceAlert {
	return {
		kind: ADMINISTRATOR_ALERT_KIND.PERMANENT_DELIVERY_FAILURE,
		message: permanentFailureMessageOf(instance, cause, statusHex),
	}
}

function warningAlertOf(instance: DeliveryInstance, statusHex: string | undefined): InstanceAlert {
	return {
		kind: ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING,
		message: storedWithWarningMessageOf(instance, statusHex),
	}
}

// dorucovaci-jadro.md 5, 5.2, 5.3, CAP-023-R09, CAP-023-R10, CAP-023-R11, CAP-023-R12, CAP-023-R16, CAP-023-R23,
// CAP-023-R24
export function storeStepOf(
	instance: DeliveryInstance,
	outcome: ArchiveStoreOutcome,
	judgement: StoreJudgement,
	settings: DeliverySettings,
): DeliveryStep {
	const events = [deliveryAttemptEventOf(instance, outcome, judgement)]
	const recorded = (to: DeliveryInstanceState, heldForReviewCause: HeldForReviewCause | undefined) => ({
		...transitionOf(SENDING, to, instance.verificationRejections),
		countedAttempts: judgement.countedAttempts,
		statusHex: outcome.statusHex,
		acceptedTransferSyntax: outcome.acceptedTransferSyntax,
		heldForReviewCause,
	})
	const step = (
		transition: InstanceTransition,
		task: TaskAction,
		alert: InstanceAlert | undefined,
		target: TargetChange | undefined,
	): DeliveryStep => ({ transition, target, alert, task, events })
	const { decision } = judgement
	switch (decision.kind) {
		case STORE_DECISION.CONFIRMED: {
			const alert = decision.isWithWarning ? warningAlertOf(instance, outcome.statusHex) : undefined
			return step(recorded(CONFIRMED, undefined), COMPLETE, alert, undefined)
		}
		case STORE_DECISION.RETRY: {
			const delaySeconds = deliveryRetryDelaySeconds(judgement.attempts, settings.backoff)
			return step(recorded(TEMPORARILY_FAILED, undefined), waitSeconds(delaySeconds), undefined, undefined)
		}
		case STORE_DECISION.VERIFY:
			return step(
				recorded(PENDING_VERIFICATION, undefined),
				waitSeconds(settings.verificationDelaySeconds),
				undefined,
				undefined,
			)
		case STORE_DECISION.PERMANENTLY_FAILED:
			return step(
				recorded(PERMANENTLY_FAILED, undefined),
				FAIL,
				permanentAlertOf(instance, decision.cause, outcome.statusHex),
				undefined,
			)
		case STORE_DECISION.HELD_FOR_REVIEW:
			return step(
				recorded(HELD_FOR_REVIEW, decision.cause),
				FAIL,
				heldAlertOf(instance, decision.cause, outcome.statusHex),
				undefined,
			)
		case STORE_DECISION.TARGET_PAUSED:
			return step(recorded(decision.isVerifiedFirst ? PENDING_VERIFICATION : WAITING, undefined), AT_ONCE, undefined, {
				kind: TARGET_CHANGE.PAUSED,
				exchange: outcome,
			})
		case STORE_DECISION.TARGET_UNAVAILABLE:
			return step(recorded(WAITING, undefined), AT_ONCE, undefined, {
				kind: TARGET_CHANGE.UNAVAILABLE,
				exchange: outcome,
			})
		case STORE_DECISION.ABANDONED:
			return step(recorded(WAITING, undefined), AT_ONCE, undefined, undefined)
		default:
			return decision satisfies never
	}
}

// CAP-023-R25, CAP-023-S14, dorucovaci-jadro.md 5.4
export function takeOverStepOf(instance: DeliveryInstance, settings: DeliverySettings): DeliveryStep {
	return {
		transition: {
			...transitionOf(SENDING, PENDING_VERIFICATION, instance.verificationRejections),
			countedAttempts: COUNTED_ATTEMPT,
		},
		target: undefined,
		alert: undefined,
		task: waitSeconds(settings.verificationDelaySeconds),
		events: [takenOverEventOf(instance, instance.attempts + COUNTED_ATTEMPT)],
	}
}

// CAP-023-R26, datovy-model.md 4 „Doručení“ verification_rejections
function rejectionsAfter(previousRejections: number, result: string): number {
	return result === QUERY_RESULT.REJECTED ? previousRejections + 1 : NO_VERIFICATION_REJECTIONS
}

function rejectionsInARowOf(result: string, rejections: number): number | undefined {
	return result === QUERY_RESULT.REJECTED ? rejections : undefined
}

// CAP-023-R26, CAP-023-S16, CAP-023-S17, CAP-023-S18
function unansweredStepOf(
	instance: DeliveryInstance,
	exchange: ArchiveExchange,
	result: UnansweredResult,
	rejections: number,
	events: SystemJobAuditEvent[],
	settings: DeliverySettings,
): DeliveryStep {
	const pending = transitionOf(PENDING_VERIFICATION, PENDING_VERIFICATION, rejections)
	switch (result) {
		case QUERY_RESULT.TARGET_UNAVAILABLE:
			return {
				transition: pending,
				target: { kind: TARGET_CHANGE.UNAVAILABLE, exchange },
				alert: undefined,
				task: AT_ONCE,
				events,
			}
		case QUERY_RESULT.INTERRUPTED:
			return {
				transition: pending,
				target: undefined,
				alert: undefined,
				task: waitSeconds(settings.verificationDelaySeconds),
				events,
			}
		case QUERY_RESULT.REJECTED: {
			const isOnHold = rejections >= settings.rejectionsBeforeAlert
			if (!isOnHold) {
				return {
					transition: pending,
					target: undefined,
					alert: undefined,
					task: waitSeconds(settings.verificationDelaySeconds),
					events,
				}
			}
			return {
				transition: { ...pending, isOnHold },
				target: undefined,
				alert: {
					kind: ADMINISTRATOR_ALERT_KIND.VERIFICATION_REJECTED,
					message: verificationRejectedMessageOf(instance, rejections, exchange.statusHex),
				},
				task: waitSeconds(settings.verificationDelaySeconds),
				events: [...events, verificationOnHoldEventOf(instance, rejections)],
			}
		}
		default:
			return result satisfies never
	}
}

function heldStepOf(
	instance: DeliveryInstance,
	cause: HeldForReviewCause,
	events: SystemJobAuditEvent[],
): DeliveryStep {
	return {
		transition: {
			...transitionOf(PENDING_VERIFICATION, HELD_FOR_REVIEW, NO_VERIFICATION_REJECTIONS),
			heldForReviewCause: cause,
		},
		target: undefined,
		alert: heldAlertOf(instance, cause, undefined),
		task: FAIL,
		events,
	}
}

// CAP-023-R10, dorucovaci-jadro.md 5.1 „instance nenalezena“
function resendStepOf(
	instance: DeliveryInstance,
	events: SystemJobAuditEvent[],
	settings: DeliverySettings,
): DeliveryStep {
	if (isAttemptLimitReached(instance.attempts, settings.maxAttempts)) {
		return {
			transition: transitionOf(PENDING_VERIFICATION, PERMANENTLY_FAILED, NO_VERIFICATION_REJECTIONS),
			target: undefined,
			alert: permanentAlertOf(instance, PERMANENT_FAILURE_CAUSE.ATTEMPTS_EXHAUSTED, undefined),
			task: FAIL,
			events,
		}
	}
	return {
		transition: transitionOf(PENDING_VERIFICATION, WAITING, NO_VERIFICATION_REJECTIONS),
		target: undefined,
		alert: undefined,
		task: AT_ONCE,
		events,
	}
}

// CAP-023-R09, CAP-023-R13, CAP-023-R26, CAP-023-S15, CAP-023-S19, CAP-023-S20
function notFoundStepOf(
	instance: DeliveryInstance,
	study: StudyVerification | undefined,
	events: SystemJobAuditEvent[],
	settings: DeliverySettings,
): DeliveryStep {
	if (study === undefined) {
		return heldStepOf(instance, HELD_FOR_REVIEW_CAUSE.ARTIFACT_SHA256_MISMATCH, events)
	}
	const rejections = rejectionsAfter(NO_VERIFICATION_REJECTIONS, study.result)
	const studyEvents = [
		...events,
		verificationQueryEventOf(
			instance,
			VERIFICATION_LEVEL.STUDY,
			study.outcome,
			study.result,
			rejectionsInARowOf(study.result, rejections),
		),
	]
	switch (study.result) {
		case STUDY_QUERY_RESULT.IDENTITY_CONFLICT:
			return heldStepOf(instance, HELD_FOR_REVIEW_CAUSE.STUDY_IDENTITY_CONFLICT, studyEvents)
		case STUDY_QUERY_RESULT.NO_IDENTITY_CONFLICT:
			return resendStepOf(instance, studyEvents, settings)
		case STUDY_QUERY_RESULT.TARGET_UNAVAILABLE:
		case STUDY_QUERY_RESULT.INTERRUPTED:
		case STUDY_QUERY_RESULT.REJECTED:
			return unansweredStepOf(instance, study.outcome, study.result, rejections, studyEvents, settings)
		default:
			return study.result satisfies never
	}
}

// dorucovaci-jadro.md 5.1, CAP-023-R13, CAP-023-R14, CAP-023-R26, CAP-026-R05
export function verificationStepOf(
	instance: DeliveryInstance,
	verification: Verification,
	settings: DeliverySettings,
): DeliveryStep {
	const { image } = verification
	const rejections = rejectionsAfter(instance.verificationRejections, image.result)
	const events = [
		verificationQueryEventOf(
			instance,
			VERIFICATION_LEVEL.IMAGE,
			image.outcome,
			image.result,
			rejectionsInARowOf(image.result, rejections),
		),
	]
	switch (image.result) {
		case QUERY_RESULT.FOUND:
			return {
				transition: transitionOf(PENDING_VERIFICATION, CONFIRMED, NO_VERIFICATION_REJECTIONS),
				target: undefined,
				alert: undefined,
				task: COMPLETE,
				events,
			}
		case QUERY_RESULT.NOT_FOUND:
			return notFoundStepOf(instance, verification.study, events, settings)
		case QUERY_RESULT.TARGET_UNAVAILABLE:
		case QUERY_RESULT.INTERRUPTED:
		case QUERY_RESULT.REJECTED:
			return unansweredStepOf(instance, image.outcome, image.result, rejections, events, settings)
		default:
			return image.result satisfies never
	}
}
