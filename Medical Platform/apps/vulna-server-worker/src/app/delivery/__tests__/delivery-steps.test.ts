import { ADMINISTRATOR_ALERT_KIND, DELIVERY_INSTANCE_STATE, HELD_FOR_REVIEW_CAUSE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import {
	ARCHIVE_NOT_SENT_REASON,
	ARCHIVE_OUTCOME_CLASS,
	ARCHIVE_PHASE,
	ARCHIVE_RETRY_POLICY,
	instanceQueryResultOf,
	QUERY_RESULT,
	STUDY_QUERY_RESULT,
	storeJudgementOf,
	studyQueryResultOf,
} from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { TARGET_CHANGE, TASK_ACTION } from "../constants/delivery.constants"
import type { Verification } from "../types/delivery.types"
import { storeStepOf, takeOverStepOf, verificationStepOf } from "../utils/delivery-steps"
import {
	classification,
	instanceOf,
	MAX_ATTEMPTS,
	PATIENT_ID,
	PENDING_INSTANCE,
	queried,
	REJECTIONS_BEFORE_ALERT,
	SENDING_INSTANCE,
	SOP_INSTANCE_UID,
	settingsWith,
	stored,
	UNREACHABLE,
	VERIFICATION_DELAY_SECONDS,
} from "./delivery-fixtures"

const SETTINGS = settingsWith()
const AT_ONCE = { kind: TASK_ACTION.WAIT, delayMilliseconds: 0 }
const { WAITING, SENDING, PENDING_VERIFICATION, CONFIRMED, TEMPORARILY_FAILED, PERMANENTLY_FAILED, HELD_FOR_REVIEW } =
	DELIVERY_INSTANCE_STATE

function storeStep(outcome = stored("0000"), instance = SENDING_INSTANCE) {
	return storeStepOf(instance, outcome, storeJudgementOf(outcome, instance.attempts, MAX_ATTEMPTS), SETTINGS)
}

function verification(imageMatches: readonly string[] | undefined, studyPatients?: readonly string[]): Verification {
	const image = queried({ matchedValues: imageMatches ?? [] })
	const studyOutcome = studyPatients === undefined ? undefined : queried({ matchedValues: studyPatients })
	return {
		image: { outcome: image, result: instanceQueryResultOf(image, SOP_INSTANCE_UID) },
		study:
			studyOutcome === undefined
				? undefined
				: { outcome: studyOutcome, result: studyQueryResultOf(studyOutcome, PATIENT_ID) },
	}
}

const REJECTED_QUERY = queried({ statusHex: "C000", isComplete: false })

function rejectedVerification(): Verification {
	return { image: { outcome: REJECTED_QUERY, result: QUERY_RESULT.REJECTED }, study: undefined }
}

describe("delivery steps after a C-STORE ✓ dorucovaci-jadro.md 5, 5.3", () => {
	it("confirms, anchors and completes a successful C-STORE with its attempt in the audit CAP-023-S01", () => {
		const step = storeStep()

		expect(step.transition).toMatchObject({ from: SENDING, to: CONFIRMED, countedAttempts: 1, statusHex: "0000" })
		expect(step.task).toEqual({ kind: TASK_ACTION.COMPLETE })
		expect(step.alert).toBeUndefined()
		expect(step.events).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.DELIVERY_ATTEMPT,
				outcome: "success",
				details: expect.objectContaining({ result: "confirmed", attempts: 1, rule_id: "STORE.0000" }),
			}),
		])
	})

	it("holds an identifier mismatch, fails the task and alerts the administrator CAP-023-S02, CAP-023-S27", () => {
		const outcome = stored("C002", {
			classification: classification({
				outcomeClass: ARCHIVE_OUTCOME_CLASS.IDENTITY_CONFLICT,
				clinicalSafetyQueue: true,
				alertAdmin: true,
				ruleId: "STORE.C002",
			}),
		})
		const step = storeStep(outcome)

		expect(step.transition).toMatchObject({
			to: HELD_FOR_REVIEW,
			heldForReviewCause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS,
			statusHex: "C002",
		})
		expect(step.task).toEqual({ kind: TASK_ACTION.FAIL })
		expect(step.alert?.kind).toBe(ADMINISTRATOR_ALERT_KIND.HELD_FOR_REVIEW)
		expect(JSON.stringify(step)).not.toContain("clinical_safety")
	})

	it("waits the verification delay after an unknown outcome CAP-023-S03", () => {
		const unknown = stored(undefined, {
			phase: ARCHIVE_PHASE.UNKNOWN,
			classification: classification({
				outcomeClass: ARCHIVE_OUTCOME_CLASS.UNKNOWN_OUTCOME,
				retryPolicy: ARCHIVE_RETRY_POLICY.VERIFY_THEN_RETRY,
				ruleId: "STORE.UNKNOWN",
			}),
		})
		const step = storeStep(unknown)

		expect(step.transition).toMatchObject({ to: PENDING_VERIFICATION, countedAttempts: 1 })
		expect(step.task).toEqual({
			kind: TASK_ACTION.WAIT,
			delayMilliseconds: VERIFICATION_DELAY_SECONDS * MILLISECONDS_PER_SECOND,
		})
	})

	it("pauses the target, keeps the row waiting and counts nothing on a configuration error CAP-023-S05, CAP-023-S11", () => {
		const outcome = stored("A706", {
			classification: classification({
				outcomeClass: ARCHIVE_OUTCOME_CLASS.CONFIGURATION,
				alertAdmin: true,
				pauseTarget: true,
				ruleId: "STORE.A706",
			}),
		})
		const step = storeStep(outcome)

		expect(step.transition).toMatchObject({ to: WAITING, countedAttempts: 0 })
		expect(step.target).toEqual({ kind: TARGET_CHANGE.PAUSED, exchange: outcome })
		expect(step.task).toEqual(AT_ONCE)
	})

	it("sends a row stopped by A703 to verification once the target is resumed CAP-023-S12", () => {
		const outcome = stored("A703", {
			classification: classification({
				outcomeClass: ARCHIVE_OUTCOME_CLASS.CONFIGURATION,
				pauseTarget: true,
				ruleId: "STORE.A703",
			}),
		})

		expect(storeStep(outcome).transition.to).toBe(PENDING_VERIFICATION)
	})

	it("marks the target unavailable and keeps the attempts when the PACS does not answer CAP-023-S13", () => {
		const step = storeStep(UNREACHABLE, instanceOf(SENDING, { attempts: MAX_ATTEMPTS - 1 }))

		expect(step.transition).toMatchObject({ to: WAITING, countedAttempts: 0 })
		expect(step.target?.kind).toBe(TARGET_CHANGE.UNAVAILABLE)
		expect(step.alert).toBeUndefined()
	})

	it("holds an artifact whose stored bytes changed CAP-023-S19", () => {
		const integrity = stored(undefined, {
			phase: ARCHIVE_PHASE.NOT_SENT,
			notSentReason: ARCHIVE_NOT_SENT_REASON.ARTIFACT_INTEGRITY,
			classification: classification({
				outcomeClass: ARCHIVE_OUTCOME_CLASS.DATA,
				clinicalSafetyQueue: true,
				ruleId: "LOCAL.ARTIFACT_INTEGRITY",
			}),
		})

		expect(storeStep(integrity).transition).toMatchObject({
			to: HELD_FOR_REVIEW,
			countedAttempts: 0,
			heldForReviewCause: HELD_FOR_REVIEW_CAUSE.ARTIFACT_SHA256_MISMATCH,
		})
	})

	it("stores with a warning as confirmed and alerts the administrator CAP-023-S21", () => {
		const warning = stored("B000", {
			classification: classification({
				outcomeClass: ARCHIVE_OUTCOME_CLASS.SUCCESS_WITH_WARNING,
				retentionAnchor: true,
				alertAdmin: true,
				ruleId: "STORE.Bxxx",
			}),
		})
		const step = storeStep(warning)

		expect(step.transition).toMatchObject({ to: CONFIRMED, statusHex: "B000" })
		expect(step.alert?.kind).toBe(ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING)
		expect(step.task.kind).toBe(TASK_ACTION.COMPLETE)
	})

	it("retries a transient response with a growing delay and fails it for good when exhausted ✓ CAP-023-R10", () => {
		const transient = stored("A700", {
			classification: classification({
				outcomeClass: ARCHIVE_OUTCOME_CLASS.TRANSIENT,
				retryPolicy: ARCHIVE_RETRY_POLICY.BACKOFF,
				ruleId: "STORE.A700",
			}),
		})
		const second = storeStep(transient, instanceOf(SENDING, { attempts: 1 }))
		const last = storeStep(transient, instanceOf(SENDING, { attempts: MAX_ATTEMPTS - 1 }))

		expect(second.transition.to).toBe(TEMPORARILY_FAILED)
		expect(second.task).toEqual({ kind: TASK_ACTION.WAIT, delayMilliseconds: 120 * MILLISECONDS_PER_SECOND })
		expect(last.transition.to).toBe(PERMANENTLY_FAILED)
		expect(last.alert?.kind).toBe(ADMINISTRATOR_ALERT_KIND.PERMANENT_DELIVERY_FAILURE)
		expect(last.task.kind).toBe(TASK_ACTION.FAIL)
	})
})

describe("taking over a row left in sending ✓ dorucovaci-jadro.md 5.4", () => {
	it("verifies before anything is sent again and counts the interrupted attempt CAP-023-S14", () => {
		const step = takeOverStepOf(instanceOf(SENDING, { attempts: 2 }), SETTINGS)

		expect(step.transition).toMatchObject({ from: SENDING, to: PENDING_VERIFICATION, countedAttempts: 1 })
		expect(step.task.kind).toBe(TASK_ACTION.WAIT)
		expect(step.events[0]?.details).toMatchObject({ result: "taken_over", attempts: 3 })
	})
})

describe("delivery steps after a verification query ✓ dorucovaci-jadro.md 5.1", () => {
	it("confirms an instance the PACS already holds, without sending CAP-023-S14, CAP-026-R05", () => {
		const step = verificationStepOf(PENDING_INSTANCE, verification([SOP_INSTANCE_UID]), SETTINGS)

		expect(step.transition).toMatchObject({ from: PENDING_VERIFICATION, to: CONFIRMED, countedAttempts: 0 })
		expect(step.task.kind).toBe(TASK_ACTION.COMPLETE)
		expect(step.events).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.VERIFICATION_QUERY,
				details: expect.objectContaining({ level: "image", result: QUERY_RESULT.FOUND }),
			}),
		])
	})

	it("sends again an instance the PACS does not hold when the study is ours CAP-023-S15", () => {
		const step = verificationStepOf(PENDING_INSTANCE, verification([], [PATIENT_ID]), SETTINGS)

		expect(step.transition).toMatchObject({ to: WAITING, verificationRejections: 0 })
		expect(step.task).toEqual(AT_ONCE)
		expect(step.events.map((event) => event.details.result)).toEqual([
			QUERY_RESULT.NOT_FOUND,
			STUDY_QUERY_RESULT.NO_IDENTITY_CONFLICT,
		])
	})

	it("fails for good an instance that is not in the PACS after the last allowed attempt ✓ CAP-023-R10", () => {
		const exhausted = instanceOf(PENDING_VERIFICATION, { attempts: MAX_ATTEMPTS })
		const step = verificationStepOf(exhausted, verification([], []), SETTINGS)

		expect(step.transition.to).toBe(PERMANENTLY_FAILED)
		expect(step.alert?.kind).toBe(ADMINISTRATOR_ALERT_KIND.PERMANENT_DELIVERY_FAILURE)
	})

	it("waits without counting while the PACS is unavailable during the verification CAP-023-S16", () => {
		const unavailable = queried({
			phase: ARCHIVE_PHASE.NOT_SENT,
			notSentReason: ARCHIVE_NOT_SENT_REASON.CONNECT_FAILED,
			statusHex: undefined,
			isComplete: false,
		})
		const step = verificationStepOf(
			instanceOf(PENDING_VERIFICATION, { verificationRejections: 1 }),
			{ image: { outcome: unavailable, result: QUERY_RESULT.TARGET_UNAVAILABLE }, study: undefined },
			SETTINGS,
		)

		expect(step.transition).toMatchObject({
			from: PENDING_VERIFICATION,
			to: PENDING_VERIFICATION,
			countedAttempts: 0,
			verificationRejections: 0,
		})
		expect(step.target?.kind).toBe(TARGET_CHANGE.UNAVAILABLE)
		expect(step.task).toEqual(AT_ONCE)
	})

	it("repeats an interrupted query after the delay without sending CAP-023-S17", () => {
		const cut = queried({ phase: ARCHIVE_PHASE.UNKNOWN, statusHex: undefined, isComplete: false })
		const step = verificationStepOf(
			instanceOf(PENDING_VERIFICATION, { verificationRejections: 2 }),
			{ image: { outcome: cut, result: QUERY_RESULT.INTERRUPTED }, study: undefined },
			SETTINGS,
		)

		expect(step.transition).toMatchObject({ to: PENDING_VERIFICATION, verificationRejections: 0, isOnHold: false })
		expect(step.task).toEqual({
			kind: TASK_ACTION.WAIT,
			delayMilliseconds: VERIFICATION_DELAY_SECONDS * MILLISECONDS_PER_SECOND,
		})
		expect(step.events[0]?.details.result).toBe(QUERY_RESULT.INTERRUPTED)
	})

	it("counts rejected queries and puts the verification on hold with an alert at the limit CAP-023-S18", () => {
		const second = verificationStepOf(
			instanceOf(PENDING_VERIFICATION, { verificationRejections: REJECTIONS_BEFORE_ALERT - 2 }),
			rejectedVerification(),
			SETTINGS,
		)
		const third = verificationStepOf(
			instanceOf(PENDING_VERIFICATION, { verificationRejections: REJECTIONS_BEFORE_ALERT - 1 }),
			rejectedVerification(),
			SETTINGS,
		)

		expect(second.transition).toMatchObject({ verificationRejections: REJECTIONS_BEFORE_ALERT - 1, isOnHold: false })
		expect(second.alert).toBeUndefined()
		expect(third.transition).toMatchObject({
			to: PENDING_VERIFICATION,
			verificationRejections: REJECTIONS_BEFORE_ALERT,
			isOnHold: true,
		})
		expect(third.alert?.kind).toBe(ADMINISTRATOR_ALERT_KIND.VERIFICATION_REJECTED)
		expect(third.events.map((event) => event.eventType)).toEqual([
			AUDIT_EVENT_TYPE.VERIFICATION_QUERY,
			AUDIT_EVENT_TYPE.VERIFICATION_ON_HOLD,
		])
	})

	it("holds an instance whose study belongs to another patient in the PACS CAP-023-S20", () => {
		const step = verificationStepOf(PENDING_INSTANCE, verification([], ["7051234567"]), SETTINGS)

		expect(step.transition).toMatchObject({
			to: HELD_FOR_REVIEW,
			heldForReviewCause: HELD_FOR_REVIEW_CAUSE.STUDY_IDENTITY_CONFLICT,
		})
		expect(step.task.kind).toBe(TASK_ACTION.FAIL)
		expect(step.alert?.kind).toBe(ADMINISTRATOR_ALERT_KIND.HELD_FOR_REVIEW)
	})

	it("holds an instance whose stored bytes cannot be read back, without sending CAP-023-S19", () => {
		const step = verificationStepOf(PENDING_INSTANCE, verification([]), SETTINGS)

		expect(step.transition).toMatchObject({
			to: HELD_FOR_REVIEW,
			heldForReviewCause: HELD_FOR_REVIEW_CAUSE.ARTIFACT_SHA256_MISMATCH,
		})
	})

	it("never sends again on a rejected study query and counts it from zero after the instance was not found CAP-023-S18", () => {
		const rejectedStudy = queried({ statusHex: "A900", isComplete: false })
		const step = verificationStepOf(
			instanceOf(PENDING_VERIFICATION, { verificationRejections: REJECTIONS_BEFORE_ALERT - 1 }),
			{ image: verification([]).image, study: { outcome: rejectedStudy, result: STUDY_QUERY_RESULT.REJECTED } },
			SETTINGS,
		)

		expect(step.transition).toMatchObject({ to: PENDING_VERIFICATION, verificationRejections: 1, isOnHold: false })
		expect(step.alert).toBeUndefined()
		expect(step.events.map((event) => event.details.rejections_in_a_row)).toEqual([undefined, 1])
	})

	it("never sends again on an interrupted study query CAP-023-S17", () => {
		const interruptedStudy = queried({ statusHex: "FE00", isComplete: false })
		const step = verificationStepOf(
			PENDING_INSTANCE,
			{
				image: verification([]).image,
				study: { outcome: interruptedStudy, result: STUDY_QUERY_RESULT.INTERRUPTED },
			},
			SETTINGS,
		)

		expect(step.transition).toMatchObject({ to: PENDING_VERIFICATION, verificationRejections: 0 })
		expect(step.task).toEqual({
			kind: TASK_ACTION.WAIT,
			delayMilliseconds: VERIFICATION_DELAY_SECONDS * MILLISECONDS_PER_SECOND,
		})
	})
})
