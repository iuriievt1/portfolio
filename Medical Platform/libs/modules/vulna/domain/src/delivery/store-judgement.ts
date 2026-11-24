import { HELD_FOR_REVIEW_CAUSE, type HeldForReviewCause } from "@ansora/contracts"
import {
	ARCHIVE_NOT_SENT_REASON,
	ARCHIVE_OUTCOME_CLASS,
	ARCHIVE_PHASE,
	ARCHIVE_RETRY_POLICY,
	type ArchiveStoreOutcome,
} from "../ports/archive"
import { DIMSE_STATUS } from "./dimse-status"

// dorucovaci-jadro.md 5, 5.3, integrace-dicom.md 8.1, 8.3
export const STORE_DECISION = {
	CONFIRMED: "confirmed",
	RETRY: "retry",
	VERIFY: "verify",
	PERMANENTLY_FAILED: "permanently_failed",
	HELD_FOR_REVIEW: "held_for_review",
	TARGET_PAUSED: "target_paused",
	TARGET_UNAVAILABLE: "target_unavailable",
	ABANDONED: "abandoned",
} as const

// datovy-model.md 4 „Doručení“ permanently_failed, CAP-023-R10, CAP-023-R12
export const PERMANENT_FAILURE_CAUSE = {
	ATTEMPTS_EXHAUSTED: "attempts_exhausted",
	UNDOCUMENTED_STATUS: "undocumented_status",
} as const

export type PermanentFailureCause = (typeof PERMANENT_FAILURE_CAUSE)[keyof typeof PERMANENT_FAILURE_CAUSE]

// CAP-023-R10
export const COUNTED_ATTEMPT = 1
const UNCOUNTED_ATTEMPT = 0

export type StoreDecision =
	| { kind: typeof STORE_DECISION.CONFIRMED; isWithWarning: boolean }
	| { kind: typeof STORE_DECISION.RETRY }
	| { kind: typeof STORE_DECISION.VERIFY }
	| { kind: typeof STORE_DECISION.PERMANENTLY_FAILED; cause: PermanentFailureCause }
	| { kind: typeof STORE_DECISION.HELD_FOR_REVIEW; cause: HeldForReviewCause }
	| { kind: typeof STORE_DECISION.TARGET_PAUSED; isVerifiedFirst: boolean }
	| { kind: typeof STORE_DECISION.TARGET_UNAVAILABLE }
	| { kind: typeof STORE_DECISION.ABANDONED }

export interface StoreJudgement {
	decision: StoreDecision
	countedAttempts: number
	attempts: number
}

// CAP-023-R10
export function isAttemptLimitReached(attempts: number, maxAttempts: number): boolean {
	return attempts >= maxAttempts
}

function heldFor(outcome: ArchiveStoreOutcome): StoreDecision {
	const cause =
		outcome.notSentReason === ARCHIVE_NOT_SENT_REASON.ARTIFACT_INTEGRITY
			? HELD_FOR_REVIEW_CAUSE.ARTIFACT_SHA256_MISMATCH
			: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS
	return { kind: STORE_DECISION.HELD_FOR_REVIEW, cause }
}

function unreachable(outcome: ArchiveStoreOutcome): Error {
	return new Error(`C-STORE cannot end ${outcome.phase} by rule ${outcome.classification.ruleId}`)
}

// CAP-023-R24, dorucovaci-jadro.md 5 (?)
function unsentDecisionOf(outcome: ArchiveStoreOutcome): StoreDecision {
	const reason = outcome.notSentReason
	switch (reason) {
		case ARCHIVE_NOT_SENT_REASON.ABORTED_BEFORE_CONNECT:
			return { kind: STORE_DECISION.ABANDONED }
		case ARCHIVE_NOT_SENT_REASON.CONNECT_FAILED:
		case ARCHIVE_NOT_SENT_REASON.CLOSED_BEFORE_DATA:
		case ARCHIVE_NOT_SENT_REASON.ASSOCIATION_REJECTED:
			return { kind: STORE_DECISION.TARGET_UNAVAILABLE }
		case ARCHIVE_NOT_SENT_REASON.NO_ACCEPTED_TRANSFER_SYNTAX:
		case ARCHIVE_NOT_SENT_REASON.ARTIFACT_INTEGRITY:
		case ARCHIVE_NOT_SENT_REASON.INVALID_QUERY:
		case undefined:
			throw unreachable(outcome)
		default:
			return reason satisfies never
	}
}

// integrace-dicom.md 8.1, CAP-023-R10, CAP-023-R12
function answeredDecisionOf(outcome: ArchiveStoreOutcome): StoreDecision {
	const { classification } = outcome
	const outcomeClass = classification.outcomeClass
	switch (outcomeClass) {
		case ARCHIVE_OUTCOME_CLASS.SUCCESS:
			return { kind: STORE_DECISION.CONFIRMED, isWithWarning: false }
		case ARCHIVE_OUTCOME_CLASS.SUCCESS_WITH_WARNING:
			return { kind: STORE_DECISION.CONFIRMED, isWithWarning: true }
		case ARCHIVE_OUTCOME_CLASS.TRANSIENT:
			return classification.retryPolicy === ARCHIVE_RETRY_POLICY.VERIFY_THEN_RETRY
				? { kind: STORE_DECISION.VERIFY }
				: { kind: STORE_DECISION.RETRY }
		case ARCHIVE_OUTCOME_CLASS.UNDOCUMENTED_STATUS:
			return { kind: STORE_DECISION.PERMANENTLY_FAILED, cause: PERMANENT_FAILURE_CAUSE.UNDOCUMENTED_STATUS }
		case ARCHIVE_OUTCOME_CLASS.CONFIGURATION:
		case ARCHIVE_OUTCOME_CLASS.DATA:
		case ARCHIVE_OUTCOME_CLASS.IDENTITY_CONFLICT:
		case ARCHIVE_OUTCOME_CLASS.UNKNOWN_OUTCOME:
		case ARCHIVE_OUTCOME_CLASS.INCOMPLETE_RESULT:
			throw unreachable(outcome)
		default:
			return outcomeClass satisfies never
	}
}

// dorucovaci-jadro.md 5, 5.2, 5.3, CAP-023-R09, CAP-023-R11, CAP-023-R16, CAP-023-R23, CAP-023-R24
function decisionOf(outcome: ArchiveStoreOutcome): StoreDecision {
	if (outcome.classification.clinicalSafetyQueue) {
		return heldFor(outcome)
	}
	if (outcome.classification.pauseTarget) {
		return {
			kind: STORE_DECISION.TARGET_PAUSED,
			isVerifiedFirst: outcome.statusHex === DIMSE_STATUS.POSTPROCESSING_ERROR,
		}
	}
	switch (outcome.phase) {
		case ARCHIVE_PHASE.UNKNOWN:
			return { kind: STORE_DECISION.VERIFY }
		case ARCHIVE_PHASE.NOT_SENT:
			return unsentDecisionOf(outcome)
		case ARCHIVE_PHASE.RESPONSE:
			return answeredDecisionOf(outcome)
		default:
			return outcome.phase satisfies never
	}
}

// CAP-023-R10, CAP-023-R24, CAP-023-S11
function isCountedAttemptOf(outcome: ArchiveStoreOutcome, decision: StoreDecision): boolean {
	switch (outcome.phase) {
		case ARCHIVE_PHASE.UNKNOWN:
			return true
		case ARCHIVE_PHASE.RESPONSE:
			return decision.kind !== STORE_DECISION.TARGET_PAUSED
		case ARCHIVE_PHASE.NOT_SENT:
			return false
		default:
			return outcome.phase satisfies never
	}
}

// dorucovaci-jadro.md 5, CAP-023-R10
export function storeJudgementOf(
	outcome: ArchiveStoreOutcome,
	previousAttempts: number,
	maxAttempts: number,
): StoreJudgement {
	const decision = decisionOf(outcome)
	const countedAttempts = isCountedAttemptOf(outcome, decision) ? COUNTED_ATTEMPT : UNCOUNTED_ATTEMPT
	const attempts = previousAttempts + countedAttempts
	if (decision.kind === STORE_DECISION.RETRY && isAttemptLimitReached(attempts, maxAttempts)) {
		return {
			decision: { kind: STORE_DECISION.PERMANENTLY_FAILED, cause: PERMANENT_FAILURE_CAUSE.ATTEMPTS_EXHAUSTED },
			countedAttempts,
			attempts,
		}
	}
	return { decision, countedAttempts, attempts }
}
