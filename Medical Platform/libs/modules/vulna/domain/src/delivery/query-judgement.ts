import {
	ARCHIVE_NOT_SENT_REASON,
	ARCHIVE_OUTCOME_CLASS,
	ARCHIVE_PHASE,
	type ArchiveQueryOutcome,
} from "../ports/archive"
import { DIMSE_STATUS } from "./dimse-status"

// dorucovaci-jadro.md 5.1, CAP-023-R26, datovy-model.md 8
export const QUERY_RESULT = {
	FOUND: "found",
	NOT_FOUND: "not_found",
	TARGET_UNAVAILABLE: "target_unavailable",
	INTERRUPTED: "interrupted",
	REJECTED: "rejected",
} as const

export type QueryResult = (typeof QUERY_RESULT)[keyof typeof QUERY_RESULT]

// CAP-023-R09, CAP-023-R13, CAP-023-S20 (?)
export const STUDY_QUERY_RESULT = {
	IDENTITY_CONFLICT: "identity_conflict",
	NO_IDENTITY_CONFLICT: "no_identity_conflict",
	TARGET_UNAVAILABLE: QUERY_RESULT.TARGET_UNAVAILABLE,
	INTERRUPTED: QUERY_RESULT.INTERRUPTED,
	REJECTED: QUERY_RESULT.REJECTED,
} as const

export type StudyQueryResult = (typeof STUDY_QUERY_RESULT)[keyof typeof STUDY_QUERY_RESULT]

const ANSWERED = "answered"

type QueryProgress =
	| typeof ANSWERED
	| typeof QUERY_RESULT.TARGET_UNAVAILABLE
	| typeof QUERY_RESULT.INTERRUPTED
	| typeof QUERY_RESULT.REJECTED

// CAP-023-R24, CAP-023-R26, dorucovaci-jadro.md 5.1 (?)
function unsentProgressOf(outcome: ArchiveQueryOutcome): QueryProgress {
	const reason = outcome.notSentReason
	switch (reason) {
		case ARCHIVE_NOT_SENT_REASON.ABORTED_BEFORE_CONNECT:
			return QUERY_RESULT.INTERRUPTED
		case ARCHIVE_NOT_SENT_REASON.CONNECT_FAILED:
		case ARCHIVE_NOT_SENT_REASON.CLOSED_BEFORE_DATA:
			return QUERY_RESULT.TARGET_UNAVAILABLE
		case ARCHIVE_NOT_SENT_REASON.ASSOCIATION_REJECTED:
			return outcome.classification.outcomeClass === ARCHIVE_OUTCOME_CLASS.TRANSIENT
				? QUERY_RESULT.TARGET_UNAVAILABLE
				: QUERY_RESULT.REJECTED
		case ARCHIVE_NOT_SENT_REASON.NO_ACCEPTED_TRANSFER_SYNTAX:
		case ARCHIVE_NOT_SENT_REASON.ARTIFACT_INTEGRITY:
		case ARCHIVE_NOT_SENT_REASON.INVALID_QUERY:
		case undefined:
			return QUERY_RESULT.REJECTED
		default:
			return reason satisfies never
	}
}

// dorucovaci-jadro.md 5.1, integrace-dicom.md 8.2
function answeredProgressOf(outcome: ArchiveQueryOutcome): QueryProgress {
	switch (outcome.statusHex) {
		case undefined:
		case DIMSE_STATUS.CANCEL:
			return QUERY_RESULT.INTERRUPTED
		case DIMSE_STATUS.SUCCESS:
			return outcome.isComplete ? ANSWERED : QUERY_RESULT.INTERRUPTED
		default:
			return QUERY_RESULT.REJECTED
	}
}

function queryProgressOf(outcome: ArchiveQueryOutcome): QueryProgress {
	return outcome.phase === ARCHIVE_PHASE.NOT_SENT ? unsentProgressOf(outcome) : answeredProgressOf(outcome)
}

// CAP-023-R13, CAP-023-R26, integrace-dicom.md 9
export function instanceQueryResultOf(outcome: ArchiveQueryOutcome, sopInstanceUid: string): QueryResult {
	const progress = queryProgressOf(outcome)
	if (progress !== ANSWERED) {
		return progress
	}
	return outcome.matchedValues.includes(sopInstanceUid) ? QUERY_RESULT.FOUND : QUERY_RESULT.NOT_FOUND
}

// CAP-023-R09, CAP-023-R13, CAP-023-S20 (?)
export function studyQueryResultOf(outcome: ArchiveQueryOutcome, patientId: string): StudyQueryResult {
	const progress = queryProgressOf(outcome)
	if (progress !== ANSWERED) {
		return progress
	}
	const isOwnPatient = outcome.matchedValues.every((matched) => matched === patientId)
	return isOwnPatient ? STUDY_QUERY_RESULT.NO_IDENTITY_CONFLICT : STUDY_QUERY_RESULT.IDENTITY_CONFLICT
}
