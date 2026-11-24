import { HELD_FOR_REVIEW_CAUSE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import {
	deliveryRetryDelaySeconds,
	instanceQueryResultOf,
	isAttemptLimitReached,
	PERMANENT_FAILURE_CAUSE,
	QUERY_RESULT,
	STORE_DECISION,
	STUDY_QUERY_RESULT,
	storeJudgementOf,
	studyQueryResultOf,
} from "../delivery"
import {
	ARCHIVE_NOT_SENT_REASON,
	ARCHIVE_OUTCOME_CLASS,
	ARCHIVE_PHASE,
	ARCHIVE_RETRY_POLICY,
	type ArchiveClassification,
	type ArchiveNotSentReason,
	type ArchiveQueryOutcome,
	type ArchiveStoreOutcome,
} from "../ports"

const MAX_ATTEMPTS = 5
const NO_ATTEMPTS = 0
const COUNTED = 1
const UNCOUNTED = 0
const SOP_INSTANCE_UID = "2.25.1001"
const PATIENT_ID = "8001010008"
const OTHER_PATIENT_ID = "7051234567"

const { SUCCESS, SUCCESS_WITH_WARNING, TRANSIENT, CONFIGURATION, DATA, IDENTITY_CONFLICT } = ARCHIVE_OUTCOME_CLASS
const { UNKNOWN_OUTCOME, UNDOCUMENTED_STATUS, INCOMPLETE_RESULT } = ARCHIVE_OUTCOME_CLASS
const { NEVER, BACKOFF, VERIFY_THEN_RETRY } = ARCHIVE_RETRY_POLICY

function classified(outcomeClass: ArchiveClassification["outcomeClass"], ruleId: string): ArchiveClassification {
	return {
		outcomeClass,
		retryPolicy: NEVER,
		retentionAnchor: false,
		clinicalSafetyQueue: false,
		alertAdmin: false,
		pauseTarget: false,
		ruleId,
	}
}

// integrace-dicom.md 8.1
const STORE_STATUS_CLASSIFICATION: Readonly<Record<string, ArchiveClassification>> = {
	"0000": { ...classified(SUCCESS, "STORE.0000"), retentionAnchor: true },
	A700: { ...classified(TRANSIENT, "STORE.A700"), retryPolicy: BACKOFF },
	A701: { ...classified(TRANSIENT, "STORE.A701"), retryPolicy: BACKOFF },
	A704: { ...classified(TRANSIENT, "STORE.A704"), retryPolicy: BACKOFF },
	C001: { ...classified(TRANSIENT, "STORE.C001"), retryPolicy: VERIFY_THEN_RETRY },
	A702: { ...classified(CONFIGURATION, "STORE.A702"), alertAdmin: true, pauseTarget: true },
	A703: { ...classified(CONFIGURATION, "STORE.A703"), alertAdmin: true, pauseTarget: true },
	A705: { ...classified(CONFIGURATION, "STORE.A705"), alertAdmin: true, pauseTarget: true },
	A706: { ...classified(CONFIGURATION, "STORE.A706"), alertAdmin: true, pauseTarget: true },
	"0122": { ...classified(CONFIGURATION, "STORE.0122"), alertAdmin: true, pauseTarget: true },
	A900: { ...classified(DATA, "STORE.A900"), clinicalSafetyQueue: true, alertAdmin: true },
	C000: { ...classified(DATA, "STORE.C000"), clinicalSafetyQueue: true, alertAdmin: true },
	C003: { ...classified(DATA, "STORE.C003"), clinicalSafetyQueue: true, alertAdmin: true },
	C004: { ...classified(DATA, "STORE.C004"), clinicalSafetyQueue: true, alertAdmin: true },
	C002: { ...classified(IDENTITY_CONFLICT, "STORE.C002"), clinicalSafetyQueue: true, alertAdmin: true },
	B000: { ...classified(SUCCESS_WITH_WARNING, "STORE.Bxxx"), retentionAnchor: true, alertAdmin: true },
	B007: { ...classified(SUCCESS_WITH_WARNING, "STORE.Bxxx"), retentionAnchor: true, alertAdmin: true },
	C123: { ...classified(UNDOCUMENTED_STATUS, "STORE.UNDOCUMENTED"), alertAdmin: true },
}

function answered(statusHex: string): ArchiveStoreOutcome {
	const classification = STORE_STATUS_CLASSIFICATION[statusHex]
	if (classification === undefined) {
		throw new Error(`no golden classification for ${statusHex}`)
	}
	return {
		phase: ARCHIVE_PHASE.RESPONSE,
		notSentReason: undefined,
		timeout: undefined,
		statusHex,
		errorComment: undefined,
		classification,
		acceptedTransferSyntax: "1.2.840.10008.1.2.4.50",
	}
}

function unsent(notSentReason: ArchiveNotSentReason, classification: ArchiveClassification): ArchiveStoreOutcome {
	return {
		phase: ARCHIVE_PHASE.NOT_SENT,
		notSentReason,
		timeout: undefined,
		statusHex: undefined,
		errorComment: undefined,
		classification,
		acceptedTransferSyntax: undefined,
	}
}

const TRANSIENT_NOT_SENT = { ...classified(TRANSIENT, "STORE.NOT_SENT"), retryPolicy: BACKOFF }
const TRANSIENT_REJECTION = { ...classified(TRANSIENT, "RJ.2/3/1"), retryPolicy: BACKOFF }
const PERMANENT_REJECTION = { ...classified(CONFIGURATION, "RJ.1/1/7"), alertAdmin: true, pauseTarget: true }
const PAUSING = {
	...classified(CONFIGURATION, "STORE.NO_ACCEPTED_TRANSFER_SYNTAX"),
	alertAdmin: true,
	pauseTarget: true,
}
const INTEGRITY = { ...classified(DATA, "LOCAL.ARTIFACT_INTEGRITY"), clinicalSafetyQueue: true, alertAdmin: true }

const UNKNOWN: ArchiveStoreOutcome = {
	phase: ARCHIVE_PHASE.UNKNOWN,
	notSentReason: undefined,
	timeout: undefined,
	statusHex: undefined,
	errorComment: undefined,
	classification: { ...classified(UNKNOWN_OUTCOME, "STORE.UNKNOWN"), retryPolicy: VERIFY_THEN_RETRY },
	acceptedTransferSyntax: "1.2.840.10008.1.2.4.50",
}

describe("C-STORE judgement ✓ dorucovaci-jadro.md 5, integrace-dicom.md 8.1", () => {
	it("confirms a successful C-STORE and counts the attempt CAP-023-S01", () => {
		expect(storeJudgementOf(answered("0000"), NO_ATTEMPTS, MAX_ATTEMPTS)).toEqual({
			decision: { kind: STORE_DECISION.CONFIRMED, isWithWarning: false },
			countedAttempts: COUNTED,
			attempts: COUNTED,
		})
	})

	it.each(["A900", "C000", "C002", "C003", "C004"])(
		"B14 never reports %s as success nor retries it automatically ✓ ADR-005, ADR-024",
		(statusHex) => {
			for (const previousAttempts of [NO_ATTEMPTS, MAX_ATTEMPTS - 1]) {
				const { decision } = storeJudgementOf(answered(statusHex), previousAttempts, MAX_ATTEMPTS)
				expect(decision).toEqual({ kind: STORE_DECISION.HELD_FOR_REVIEW, cause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS })
			}
		},
	)

	it("verifies an association that ended after the data left, also on the last attempt CAP-023-S03, CAP-023-R26", () => {
		expect(storeJudgementOf(UNKNOWN, MAX_ATTEMPTS - 1, MAX_ATTEMPTS)).toEqual({
			decision: { kind: STORE_DECISION.VERIFY },
			countedAttempts: COUNTED,
			attempts: MAX_ATTEMPTS,
		})
	})

	it("verifies C001 before any retry, also on the last attempt ✓ ADR-005 ř. 28, CAP-023-R26 ⚠ Q-031", () => {
		expect(storeJudgementOf(answered("C001"), MAX_ATTEMPTS - 1, MAX_ATTEMPTS)).toEqual({
			decision: { kind: STORE_DECISION.VERIFY },
			countedAttempts: COUNTED,
			attempts: MAX_ATTEMPTS,
		})
	})

	it("pauses the target when no offered transfer syntax is accepted, without counting CAP-023-S04", () => {
		expect(
			storeJudgementOf(unsent(ARCHIVE_NOT_SENT_REASON.NO_ACCEPTED_TRANSFER_SYNTAX, PAUSING), NO_ATTEMPTS, MAX_ATTEMPTS),
		).toEqual({
			decision: { kind: STORE_DECISION.TARGET_PAUSED, isVerifiedFirst: false },
			countedAttempts: UNCOUNTED,
			attempts: NO_ATTEMPTS,
		})
	})

	it.each(["A702", "A705", "A706", "0122"])(
		"pauses the target on %s without consuming attempts CAP-023-S05, CAP-023-S11",
		(statusHex) => {
			expect(storeJudgementOf(answered(statusHex), MAX_ATTEMPTS - 1, MAX_ATTEMPTS)).toEqual({
				decision: { kind: STORE_DECISION.TARGET_PAUSED, isVerifiedFirst: false },
				countedAttempts: UNCOUNTED,
				attempts: MAX_ATTEMPTS - 1,
			})
		},
	)

	it("pauses the target on a permanently rejected association CAP-023-S05", () => {
		const outcome = unsent(ARCHIVE_NOT_SENT_REASON.ASSOCIATION_REJECTED, PERMANENT_REJECTION)
		expect(storeJudgementOf(outcome, NO_ATTEMPTS, MAX_ATTEMPTS).decision).toEqual({
			kind: STORE_DECISION.TARGET_PAUSED,
			isVerifiedFirst: false,
		})
	})

	it("pauses the target on A703 and verifies the instance first after resumption CAP-023-S12", () => {
		expect(storeJudgementOf(answered("A703"), NO_ATTEMPTS, MAX_ATTEMPTS).decision).toEqual({
			kind: STORE_DECISION.TARGET_PAUSED,
			isVerifiedFirst: true,
		})
	})

	it("fails an undocumented status permanently and never as a silent success CAP-023-S06", () => {
		expect(storeJudgementOf(answered("C123"), NO_ATTEMPTS, MAX_ATTEMPTS)).toEqual({
			decision: { kind: STORE_DECISION.PERMANENTLY_FAILED, cause: PERMANENT_FAILURE_CAUSE.UNDOCUMENTED_STATUS },
			countedAttempts: COUNTED,
			attempts: COUNTED,
		})
	})

	it.each([
		[ARCHIVE_NOT_SENT_REASON.CONNECT_FAILED, TRANSIENT_NOT_SENT],
		[ARCHIVE_NOT_SENT_REASON.CLOSED_BEFORE_DATA, TRANSIENT_NOT_SENT],
		[ARCHIVE_NOT_SENT_REASON.ASSOCIATION_REJECTED, TRANSIENT_REJECTION],
	])("keeps an unavailable PACS out of the attempts (%s) CAP-023-S13", (reason, classification) => {
		expect(storeJudgementOf(unsent(reason, classification), MAX_ATTEMPTS - 1, MAX_ATTEMPTS)).toEqual({
			decision: { kind: STORE_DECISION.TARGET_UNAVAILABLE },
			countedAttempts: UNCOUNTED,
			attempts: MAX_ATTEMPTS - 1,
		})
	})

	it("abandons an attempt the worker aborted before connecting, without counting it", () => {
		const outcome = unsent(ARCHIVE_NOT_SENT_REASON.ABORTED_BEFORE_CONNECT, TRANSIENT_NOT_SENT)
		expect(storeJudgementOf(outcome, NO_ATTEMPTS, MAX_ATTEMPTS)).toEqual({
			decision: { kind: STORE_DECISION.ABANDONED },
			countedAttempts: UNCOUNTED,
			attempts: NO_ATTEMPTS,
		})
	})

	it("holds an artifact whose stored bytes changed, without sending or counting CAP-023-S19", () => {
		expect(
			storeJudgementOf(unsent(ARCHIVE_NOT_SENT_REASON.ARTIFACT_INTEGRITY, INTEGRITY), NO_ATTEMPTS, MAX_ATTEMPTS),
		).toEqual({
			decision: { kind: STORE_DECISION.HELD_FOR_REVIEW, cause: HELD_FOR_REVIEW_CAUSE.ARTIFACT_SHA256_MISMATCH },
			countedAttempts: UNCOUNTED,
			attempts: NO_ATTEMPTS,
		})
	})

	it("confirms a warning status as a success with warning CAP-023-S21", () => {
		for (const statusHex of ["B000", "B007"]) {
			expect(storeJudgementOf(answered(statusHex), NO_ATTEMPTS, MAX_ATTEMPTS).decision).toEqual({
				kind: STORE_DECISION.CONFIRMED,
				isWithWarning: true,
			})
		}
	})

	it.each(["A700", "A701", "A704"])(
		"retries %s within the limit and fails it when exhausted ✓ CAP-023-R10",
		(status) => {
			expect(storeJudgementOf(answered(status), MAX_ATTEMPTS - 2, MAX_ATTEMPTS).decision).toEqual({
				kind: STORE_DECISION.RETRY,
			})
			expect(storeJudgementOf(answered(status), MAX_ATTEMPTS - 1, MAX_ATTEMPTS).decision).toEqual({
				kind: STORE_DECISION.PERMANENTLY_FAILED,
				cause: PERMANENT_FAILURE_CAUSE.ATTEMPTS_EXHAUSTED,
			})
		},
	)

	it("reaches the attempt limit exactly at the configured number ✓ CAP-023-R10", () => {
		expect(isAttemptLimitReached(MAX_ATTEMPTS - 1, MAX_ATTEMPTS)).toBe(false)
		expect(isAttemptLimitReached(MAX_ATTEMPTS, MAX_ATTEMPTS)).toBe(true)
	})
})

function query(overrides: Partial<ArchiveQueryOutcome>): ArchiveQueryOutcome {
	return {
		phase: ARCHIVE_PHASE.RESPONSE,
		notSentReason: undefined,
		timeout: undefined,
		statusHex: "0000",
		errorComment: undefined,
		classification: classified(SUCCESS, "FIND.0000"),
		isComplete: true,
		matchedValues: [],
		...overrides,
	}
}

function unsentQuery(notSentReason: ArchiveNotSentReason, classification: ArchiveClassification): ArchiveQueryOutcome {
	return query({
		phase: ARCHIVE_PHASE.NOT_SENT,
		notSentReason,
		statusHex: undefined,
		isComplete: false,
		classification,
	})
}

const UNSENT_FIND = { ...classified(INCOMPLETE_RESULT, "FIND.NO_FINAL_RESPONSE"), retryPolicy: BACKOFF }
const INVALID_FIND = { ...classified(DATA, "FIND.INVALID_QUERY"), alertAdmin: true }
const ROLELESS_FIND = {
	...classified(CONFIGURATION, "FIND.NO_ACCEPTED_TRANSFER_SYNTAX"),
	alertAdmin: true,
	pauseTarget: true,
}

describe("verification query judgement ✓ dorucovaci-jadro.md 5.1", () => {
	it("finds the instance only by a final 0000 with a match on SOP Instance UID CAP-023-S14", () => {
		expect(instanceQueryResultOf(query({ matchedValues: [SOP_INSTANCE_UID] }), SOP_INSTANCE_UID)).toBe(
			QUERY_RESULT.FOUND,
		)
	})

	it("reports not found only for a complete 0000 without the instance CAP-023-S15", () => {
		expect(instanceQueryResultOf(query({ matchedValues: [] }), SOP_INSTANCE_UID)).toBe(QUERY_RESULT.NOT_FOUND)
		expect(instanceQueryResultOf(query({ matchedValues: ["2.25.999"] }), SOP_INSTANCE_UID)).toBe(QUERY_RESULT.NOT_FOUND)
	})

	it.each([
		[ARCHIVE_NOT_SENT_REASON.CONNECT_FAILED, UNSENT_FIND],
		[ARCHIVE_NOT_SENT_REASON.CLOSED_BEFORE_DATA, UNSENT_FIND],
		[ARCHIVE_NOT_SENT_REASON.ASSOCIATION_REJECTED, TRANSIENT_REJECTION],
	])("waits without counting when the PACS is unavailable (%s) CAP-023-S16", (notSentReason, classification) => {
		expect(instanceQueryResultOf(unsentQuery(notSentReason, classification), SOP_INSTANCE_UID)).toBe(
			QUERY_RESULT.TARGET_UNAVAILABLE,
		)
	})

	it("repeats a query interrupted before the final answer CAP-023-S17", () => {
		const cut = query({
			phase: ARCHIVE_PHASE.UNKNOWN,
			statusHex: undefined,
			isComplete: false,
			classification: UNSENT_FIND,
		})
		const cancelled = query({ statusHex: "FE00", isComplete: false, matchedValues: [SOP_INSTANCE_UID] })
		const cancelledAfterSuccess = query({
			isComplete: false,
			matchedValues: [SOP_INSTANCE_UID],
			classification: { ...classified(INCOMPLETE_RESULT, "FIND.CANCELLED"), retryPolicy: BACKOFF },
		})
		const shutdown = unsentQuery(ARCHIVE_NOT_SENT_REASON.ABORTED_BEFORE_CONNECT, UNSENT_FIND)
		for (const outcome of [cut, cancelled, cancelledAfterSuccess, shutdown]) {
			expect(instanceQueryResultOf(outcome, SOP_INSTANCE_UID)).toBe(QUERY_RESULT.INTERRUPTED)
		}
	})

	it.each(["A700", "A900", "C000", "C001", "C123"])(
		"treats a final %s as a rejected query, never as a missing instance CAP-023-S18",
		(statusHex) => {
			const outcome = query({ statusHex, isComplete: false, matchedValues: [] })
			expect(instanceQueryResultOf(outcome, SOP_INSTANCE_UID)).toBe(QUERY_RESULT.REJECTED)
		},
	)

	it.each([
		[ARCHIVE_NOT_SENT_REASON.ASSOCIATION_REJECTED, PERMANENT_REJECTION],
		[ARCHIVE_NOT_SENT_REASON.NO_ACCEPTED_TRANSFER_SYNTAX, ROLELESS_FIND],
		[ARCHIVE_NOT_SENT_REASON.INVALID_QUERY, INVALID_FIND],
	])(
		"treats a query the PACS refused before sending (%s) as a rejection, not a pause",
		(notSentReason, classification) => {
			expect(instanceQueryResultOf(unsentQuery(notSentReason, classification), SOP_INSTANCE_UID)).toBe(
				QUERY_RESULT.REJECTED,
			)
		},
	)

	it("finds an identity conflict when the study belongs to another patient or to none named CAP-023-S20", () => {
		expect(studyQueryResultOf(query({ matchedValues: [OTHER_PATIENT_ID] }), PATIENT_ID)).toBe(
			STUDY_QUERY_RESULT.IDENTITY_CONFLICT,
		)
		expect(studyQueryResultOf(query({ matchedValues: [PATIENT_ID, ""] }), PATIENT_ID)).toBe(
			STUDY_QUERY_RESULT.IDENTITY_CONFLICT,
		)
	})

	it("sees no conflict for an unknown study or one with our patient CAP-023-S15", () => {
		expect(studyQueryResultOf(query({ matchedValues: [] }), PATIENT_ID)).toBe(STUDY_QUERY_RESULT.NO_IDENTITY_CONFLICT)
		expect(studyQueryResultOf(query({ matchedValues: [PATIENT_ID] }), PATIENT_ID)).toBe(
			STUDY_QUERY_RESULT.NO_IDENTITY_CONFLICT,
		)
	})

	it("passes an unanswered study query through as unavailable, interrupted or rejected CAP-023-S16, S17, S18", () => {
		const unavailable = unsentQuery(ARCHIVE_NOT_SENT_REASON.CONNECT_FAILED, UNSENT_FIND)
		const interrupted = query({ statusHex: "FE00", isComplete: false })
		const rejected = query({ statusHex: "A700", isComplete: false })
		expect(studyQueryResultOf(unavailable, PATIENT_ID)).toBe(STUDY_QUERY_RESULT.TARGET_UNAVAILABLE)
		expect(studyQueryResultOf(interrupted, PATIENT_ID)).toBe(STUDY_QUERY_RESULT.INTERRUPTED)
		expect(studyQueryResultOf(rejected, PATIENT_ID)).toBe(STUDY_QUERY_RESULT.REJECTED)
	})
})

describe("delivery retry delay ✓ konfigurace-a-profily.md 2.7", () => {
	const backoff = { minimumSeconds: 60, maximumSeconds: 3600 }

	it("grows exponentially from one minute up to one hour", () => {
		expect([1, 2, 3, 4, 5, 6, 7, 8].map((attempts) => deliveryRetryDelaySeconds(attempts, backoff))).toEqual([
			60, 120, 240, 480, 960, 1920, 3600, 3600,
		])
	})
})
