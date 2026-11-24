import type { AttemptedQueueTask, FailedAttemptStep, QueueFailure } from "./queue.types"
import { UNKNOWN_OUTCOMES_BEFORE_FAILURE } from "./queue-task"
import { retryDelayMilliseconds } from "./retry-delay"

// ADR-050 bod 10, CAP-021-R27
export const QUEUE_FAILURE = {
	PERMANENT: "permanent",
	UNKNOWN_OUTCOME: "unknown_outcome",
	TRANSIENT: "transient",
} as const

export const FAILED_ATTEMPT_STEP = {
	FAIL: "fail",
	FAIL_AFTER_UNKNOWN_OUTCOMES: "fail_after_unknown_outcomes",
	RETRY_LATER: "retry_later",
	RETRY_AFTER_UNKNOWN_OUTCOME: "retry_after_unknown_outcome",
} as const

// CAP-021-R27, datovy-model.md 4
function stepAfterUnknownOutcome(task: AttemptedQueueTask, delayMilliseconds: number): FailedAttemptStep {
	const unknownOutcomes = task.unknownOutcomes + 1
	if (unknownOutcomes >= UNKNOWN_OUTCOMES_BEFORE_FAILURE) {
		return { kind: FAILED_ATTEMPT_STEP.FAIL_AFTER_UNKNOWN_OUTCOMES, unknownOutcomes }
	}
	return { kind: FAILED_ATTEMPT_STEP.RETRY_AFTER_UNKNOWN_OUTCOME, delayMilliseconds, unknownOutcomes }
}

// ADR-050 bod 10, CAP-021-R27, CAP-001-S34
export function stepAfterFailedAttempt(
	task: AttemptedQueueTask,
	failure: QueueFailure,
	random: () => number = Math.random,
): FailedAttemptStep {
	switch (failure) {
		case QUEUE_FAILURE.PERMANENT:
			return { kind: FAILED_ATTEMPT_STEP.FAIL }
		case QUEUE_FAILURE.UNKNOWN_OUTCOME:
			return stepAfterUnknownOutcome(task, retryDelayMilliseconds(task.attempts, random))
		case QUEUE_FAILURE.TRANSIENT:
			return { kind: FAILED_ATTEMPT_STEP.RETRY_LATER, delayMilliseconds: retryDelayMilliseconds(task.attempts, random) }
		default:
			return failure satisfies never
	}
}
