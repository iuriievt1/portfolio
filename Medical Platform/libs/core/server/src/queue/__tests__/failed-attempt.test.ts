import { describe, expect, it } from "vitest"
import { FAILED_ATTEMPT_STEP, QUEUE_FAILURE, stepAfterFailedAttempt } from "../failed-attempt"
import { UNKNOWN_OUTCOMES_BEFORE_FAILURE } from "../queue-task"

const HIGHEST = () => 1
const TASK = { id: "33333333-3333-4333-8333-333333333333", attempts: 2, unknownOutcomes: 0 }
const DELAY_OF_SECOND_ATTEMPT_MILLISECONDS = 10_000

describe("step after a failed attempt ADR-050 bod 10, CAP-021-R27", () => {
	it("ADR-050 bod 10 fails a task whose attempt failed for good, without a retry", () => {
		expect(stepAfterFailedAttempt(TASK, QUEUE_FAILURE.PERMANENT, HIGHEST)).toEqual({ kind: FAILED_ATTEMPT_STEP.FAIL })
	})

	it("CAP-001-S34 retries a transient failure after the growing delay", () => {
		expect(stepAfterFailedAttempt(TASK, QUEUE_FAILURE.TRANSIENT, HIGHEST)).toEqual({
			kind: FAILED_ATTEMPT_STEP.RETRY_LATER,
			delayMilliseconds: DELAY_OF_SECOND_ATTEMPT_MILLISECONDS,
		})
	})

	it("CAP-021-R27 counts an unknown outcome and retries after the growing delay", () => {
		expect(stepAfterFailedAttempt(TASK, QUEUE_FAILURE.UNKNOWN_OUTCOME, HIGHEST)).toEqual({
			kind: FAILED_ATTEMPT_STEP.RETRY_AFTER_UNKNOWN_OUTCOME,
			delayMilliseconds: DELAY_OF_SECOND_ATTEMPT_MILLISECONDS,
			unknownOutcomes: 1,
		})
	})

	it("CAP-021-R27 fails a task whose outcome stayed unknown ten times in a row", () => {
		const task = { ...TASK, unknownOutcomes: UNKNOWN_OUTCOMES_BEFORE_FAILURE - 1 }

		expect(stepAfterFailedAttempt(task, QUEUE_FAILURE.UNKNOWN_OUTCOME, HIGHEST)).toEqual({
			kind: FAILED_ATTEMPT_STEP.FAIL_AFTER_UNKNOWN_OUTCOMES,
			unknownOutcomes: UNKNOWN_OUTCOMES_BEFORE_FAILURE,
		})
	})
})
